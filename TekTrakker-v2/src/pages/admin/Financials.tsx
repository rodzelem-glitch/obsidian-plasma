import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Button from '../../components/ui/Button';
import InvoiceEditorModal from '../../components/modals/InvoiceEditorModal';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import {
    Download, Calendar, Filter, FileText, TrendingUp, TrendingDown,
    MoreHorizontal, DollarSign, Wallet, ArrowUpRight, ArrowDownRight,
    PieChart, Briefcase, Calculator, Plus, User, Search, Paperclip, Users, Shield,
    Loader2, Trash2, Receipt, Camera as CameraIcon
} from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { getNextInvoiceNumber } from 'lib/numbering';
import { uploadFileToStorage } from '../../lib/storageService';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { Expense, Job, Customer } from '../../types';
import { useNavigate, useSearchParams } from 'react-router-dom';

import FinancialOverview from './financials/components/FinancialOverview';
import InvoicesTab from './financials/components/InvoicesTab';
import ExpensesTab from './financials/components/ExpensesTab';
import PnLTab from './financials/components/PnLTab';
import SalesPipeline from './SalesPipeline';
import Payables from '../Payables';
import DocumentPreview from '../../components/ui/DocumentPreview';
import WarrantyClaimsDashboard from './WarrantyClaimsDashboard';
import PayoutsTab from './financials/components/PayoutsTab';
import DisputesTab from './financials/components/DisputesTab';
import AgingReportTab from './financials/components/AgingReportTab';

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
    const [newExpensePhotos, setNewExpensePhotos] = useState<string[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [viewingReceipt, setViewingReceipt] = useState<string[] | null>(null);
    const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);
    const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
    const [custSearch, setCustSearch] = useState('');
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
    const [searchParams] = useSearchParams();

    const [isSalesOpen, setIsSalesOpen] = useState(false);
    const [isPnLOpen, setIsPnLOpen] = useState(false);
    const [isInvoicesOpen, setIsInvoicesOpen] = useState(false);
    const [isExpensesOpen, setIsExpensesOpen] = useState(false);
    const [isPayablesOpen, setIsPayablesOpen] = useState(false);
    const [isWarrantyOpen, setIsWarrantyOpen] = useState(false);
    const [isPayoutsOpen, setIsPayoutsOpen] = useState(false);
    const [isDisputesOpen, setIsDisputesOpen] = useState(false);
    const [isAgingOpen, setIsAgingOpen] = useState(false);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [disputes, setDisputes] = useState<any[]>([]);

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

    React.useEffect(() => {
        if (!state.currentOrganization?.id) return;
        const unsub = db.collection('organizations').doc(state.currentOrganization.id).collection('payouts')
            .orderBy('created', 'desc')
            .limit(50)
            .onSnapshot(snap => {
                const results = snap.docs.map(doc => doc.data());
                setPayouts(results);
            }, err => console.error("Failed to load payouts", err));
            
        const unsubDisputes = db.collection('organizations').doc(state.currentOrganization.id).collection('disputes')
            .orderBy('created', 'desc')
            .limit(50)
            .onSnapshot(snap => {
                const results = snap.docs.map(doc => doc.data());
                setDisputes(results);
            }, err => console.error("Failed to load disputes", err));

        return () => {
            unsub();
            unsubDisputes();
        };
    }, [state.currentOrganization?.id]);

    // Ensure we handle URL params opening specific modals
    React.useEffect(() => {
        const tab = searchParams.get('tab');
        const invId = searchParams.get('invoiceId');
        const expId = searchParams.get('expId');
        if (tab === 'invoices' && invId) {
            setIsInvoicesOpen(true);
            const targetJob = state.jobs.find((j: any) => j.id === invId);
            if (targetJob) {
                setEditingInvoiceId(targetJob.id);
            }
        } else if (tab === 'expenses' && expId) {
            setIsExpensesOpen(true);
            const expensesList = state.expenses.map(e => ({...e, type: 'expense', sourceId: e.id}));
            const targetExp = expensesList.find((e: any) => e.sourceId === expId);
            if (targetExp) {
                setEditingExpense(targetExp);
                setNewExpensePhotos(targetExp.receiptUrls || []);
                setIsExpenseModalOpen(true);
            }
        }
    }, [searchParams, state.jobs, state.expenses]);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const base64Promises: Promise<string>[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 5 * 1024 * 1024) {
                showToast.warn(`File "${file.name}" is too large. Receipts must be under 5MB.`);
                continue;
            }
            const promise = new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            }) as Promise<string>;
            base64Promises.push(promise);
        }

        try {
            const base64Strings = await Promise.all(base64Promises);
            if (base64Strings.length === 0) return;

            const wasEmpty = newExpensePhotos.length === 0;
            const updatedPhotos = [...newExpensePhotos, ...base64Strings];
            setNewExpensePhotos(updatedPhotos);

            if (wasEmpty) {
                setIsAnalyzing(true);
                try {
                    const analyzeFn = functions.httpsCallable('analyzeReceiptWithAI');
                    const res = await analyzeFn({ base64Images: [base64Strings[0]] });
                    const extracted = (res.data as any).data;
                    if (extracted) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        setNewExpense(prev => ({
                            ...prev,
                            vendor: prev.vendor ? prev.vendor : (extracted.vendor || prev.vendor),
                            amount: prev.amount && prev.amount !== 0 ? prev.amount : (extracted.amount ? parseFloat(extracted.amount) : prev.amount),
                            date: prev.date && prev.date !== todayStr ? prev.date : (extracted.date || prev.date),
                            category: prev.category && prev.category !== 'Materials' ? prev.category : (extracted.category || prev.category),
                            description: prev.description ? prev.description : (extracted.description || prev.description)
                        }));
                    }
                } catch (aiErr) {
                    console.error('OCR Extraction failed:', aiErr);
                } finally {
                    setIsAnalyzing(false);
                }
            }
        } catch (err) {
            console.error("Failed to read files", err);
            showToast.warn("Failed to process selected files.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleCaptureReceipt = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Prompt
            });
            if (image.base64String) {
                const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
                const wasEmpty = newExpensePhotos.length === 0;
                const updatedPhotos = [...newExpensePhotos, dataUrl];
                setNewExpensePhotos(updatedPhotos);

                if (wasEmpty) {
                    setIsAnalyzing(true);
                    try {
                        const analyzeFn = functions.httpsCallable('analyzeReceiptWithAI');
                        const res = await analyzeFn({ base64Images: [dataUrl] });
                        const extracted = (res.data as any).data;
                        if (extracted) {
                            const todayStr = new Date().toISOString().split('T')[0];
                            setNewExpense(prev => ({
                                ...prev,
                                vendor: prev.vendor ? prev.vendor : (extracted.vendor || prev.vendor),
                                amount: prev.amount && prev.amount !== 0 ? prev.amount : (extracted.amount ? parseFloat(extracted.amount) : prev.amount),
                                date: prev.date && prev.date !== todayStr ? prev.date : (extracted.date || prev.date),
                                category: prev.category && prev.category !== 'Materials' ? prev.category : (extracted.category || prev.category),
                                description: prev.description ? prev.description : (extracted.description || prev.description)
                            }));
                        }
                    } catch (aiErr) {
                        console.error('OCR Extraction failed:', aiErr);
                    } finally {
                        setIsAnalyzing(false);
                    }
                }
            }
        } catch (e) {
            console.error("Camera Cancelled/Failed", e);
        }
    };

    const allExpenses = useMemo(() => {
        const expenses = state.expenses.map(e => ({...e, type: 'expense', sourceId: e.id}));
        const vLogs = state.vehicleLogs.filter(v => v.cost > 0).map(v => ({ ...v, id: v.id, organizationId: v.organizationId, date: v.date, category: v.type === 'Fuel' ? 'Vehicle Fuel' : 'Vehicle Maint', description: v.notes, amount: v.cost, vendor: 'Fleet Expense', paidBy: v.userId, type: 'vehicleLog', sourceId: v.id }));
        return [...expenses, ...vLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.expenses, state.vehicleLogs]);

    const financialData = useMemo(() => {
        const allInvoices = state.jobs.filter((j: any) => j.invoice).map((j: any) => j.invoice);
        const totalBilled = allInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.totalAmount) || Number(inv.amount) || 0), 0);
        let totalCollected = allInvoices.filter((i: any) => i.status === 'Paid').reduce((sum: number, inv: any) => sum + (Number(inv.totalAmount) || Number(inv.amount) || 0), 0);
        
        const warrantyRevenue = (state.warrantyClaims || [])
            .filter((c: any) => c.status === 'Credit Received')
            .reduce((sum: number, c: any) => sum + (Number(c.amountApproved) || 0), 0);
            
        totalCollected += warrantyRevenue;
        const totalBilledWithWarranty = totalBilled + warrantyRevenue;
        
        const receivables = totalBilledWithWarranty - totalCollected;
        const totalExpenses = allExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        const expenseCats: Record<string, number> = {};
        allExpenses.forEach((e: any) => { expenseCats[e.category] = (expenseCats[e.category] || 0) + (Number(e.amount) || 0); });
        const netIncome = totalCollected - totalExpenses;
        return { totalBilled: totalBilledWithWarranty, totalCollected, receivables, totalExpenses, netIncome, expenseCats };
    }, [state.jobs, allExpenses, state.warrantyClaims]);

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!state.currentOrganization || isSubmittingExpense || !state.currentUser) return;
        setIsSubmittingExpense(true);
        try {
            let uploadedUrls: string[] = [];
            if (newExpensePhotos.length > 0) {
                for (let i = 0; i < newExpensePhotos.length; i++) {
                    if (newExpensePhotos[i].startsWith('http')) {
                        uploadedUrls.push(newExpensePhotos[i]);
                        continue;
                    }
                    const safeName = `expense_${Date.now()}_page${i+1}.jpg`;
                    const path = `organizations/${state.currentOrganization.id}/users/${state.currentUser.id}/receipts/${safeName}`;
                    const url = await uploadFileToStorage(path, newExpensePhotos[i]);
                    uploadedUrls.push(url);
                }
            }

            let finalReceiptData = uploadedUrls.length > 0 ? uploadedUrls[0] : (editingExpense ? (editingExpense.receiptUrl || editingExpense.receiptData) : null);
            let finalReceiptUrls = uploadedUrls.length > 0 ? uploadedUrls : (editingExpense ? (editingExpense.receiptUrls || []) : []);
            
            if (receiptFile) {
                const safeName = receiptFile.name ? receiptFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'receipt.jpg';
                const path = `organizations/${state.currentOrganization.id}/users/${state.currentUser.id}/receipts/${Date.now()}_${safeName}`;
                finalReceiptData = await uploadFileToStorage(path, receiptFile);
                finalReceiptUrls = [finalReceiptData];
            } else if (receiptPreview && !finalReceiptData) {
                 finalReceiptData = receiptPreview;
                 finalReceiptUrls = [finalReceiptData];
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
                        receiptUrls: finalReceiptUrls,
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
                        inventoryItemId: newExpense.inventoryItemId || null,
                        receiptData: null,
                        receiptUrl: finalReceiptData,
                        receiptUrls: finalReceiptUrls,
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
                    inventoryItemId: newExpense.inventoryItemId || null,
                    receiptData: null,
                    receiptUrl: finalReceiptData,
                    receiptUrls: finalReceiptUrls,
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
            setNewExpensePhotos([]);
            setIsExpenseModalOpen(false);
        } catch (error) { showToast.warn("Error saving expense."); } finally { setIsSubmittingExpense(false); }
    };

    const handleCreateInvoice = async (customer?: Customer) => {
        if (!state.currentUser) return;
        setIsCreatingInvoice(true); setIsCustomerSelectOpen(false);
        const nextInvId = await getNextInvoiceNumber(state.currentOrganization?.id || '');
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
                id: nextInvId,
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
            showToast.warn("Receipt attached successfully.");
        } catch (e) {
            showToast.warn("Upload failed.");
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

    // Data summaries for previews
    const pendingInvoices = state.jobs.filter(j => j.invoice?.status === 'Unpaid').length || 0;
    const expenseCount = allExpenses.length;
    const pnlMargin = financialData.totalCollected > 0 ? (financialData.netIncome / financialData.totalCollected) * 100 : 0;

    const warrantySummary = useMemo(() => {
        const claims = state.warrantyClaims || [];
        const pending = claims.filter((c: any) => c.status === 'Pending' || c.status === 'Submitted');
        const approved = claims.filter((c: any) => c.status === 'Approved' || c.status === 'Credit Received');
        const totalCredits = approved.reduce((sum: number, c: any) => sum + (Number(c.amountApproved) || 0), 0);
        return { total: claims.length, pending: pending.length, approved: approved.length, totalCredits };
    }, [state.warrantyClaims]);

    return (
        <div className="space-y-6 pb-24 p-4 md:p-8 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                <div className="flex gap-2 relative z-10">
                    <Button onClick={() => navigate('/admin/proposal')} className="bg-purple-600 shadow-lg text-xs font-black uppercase">+ Proposal</Button>
                    <Button onClick={() => setIsCustomerSelectOpen(true)} className="bg-emerald-600 shadow-lg text-xs font-black uppercase">+ Invoice</Button>
                    <Button onClick={() => { setEditingExpense(null); setIsExpenseModalOpen(true); }} className="bg-blue-600 shadow-lg text-xs font-black uppercase">+ Expense</Button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-0">
                
                {/* Sales Pipeline */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsSalesOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsSalesOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Briefcase size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sales Pipeline</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                         <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02]">
                             <Briefcase size={100} />
                         </div>
                         <div className="w-full px-4 space-y-3 relative z-10">
                             <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                                 <span>Estimate Conversion</span>
                                 <span className="text-purple-600 dark:text-purple-400">45%</span>
                             </div>
                             <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                 <div className="bg-purple-500 h-2 rounded-full w-[45%]"></div>
                             </div>
                         </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        View Pipeline
                    </div>
                </div>

                {/* Profit & Loss */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsPnLOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsPnLOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Calculator size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Profit & Loss</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-800 rounded-lg border border-blue-100 dark:border-blue-900/30">
                         <span className={`text-3xl font-black ${financialData.netIncome >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'} mb-1 relative z-10 drop-shadow-sm`}>
                             {fmt(financialData.netIncome)}
                         </span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10">Net Profit</span>
                         <div className="mt-2 text-[10px] font-black text-white bg-blue-500 px-2 py-0.5 rounded shadow">
                             {pnlMargin.toFixed(1)}% MARGIN
                         </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        View P&L Report
                    </div>
                </div>

                {/* Accounts Receivable */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsInvoicesOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsInvoicesOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Accounts Receivable</h3>
                    </div>
                    <div className="space-y-3 flex-1 text-sm pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-emerald-500 flex justify-between items-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Overdue / Unpaid</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded text-xs tracking-wide">
                                {fmt(financialData.receivables)}
                            </span>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-emerald-300 flex justify-between items-center transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">Pending Invoices</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700/50 px-2 py-1 rounded text-xs">
                                {pendingInvoices}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        Manage Invoices
                    </div>
                </div>

                {/* Aging Report */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsAgingOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsAgingOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">A/R Aging Report</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                         <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02]">
                             <TrendingUp size={100} />
                         </div>
                         <span className="text-3xl font-black text-amber-600 mb-1 relative z-10 drop-shadow-sm">{fmt(financialData.receivables)}</span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10">Total Overdue</span>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        View Aging Summary
                    </div>
                </div>

                {/* Expenses */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsExpensesOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsExpensesOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg group-hover:scale-110 transition-transform">
                            <TrendingDown size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Expense Tracking</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30 text-center px-4">
                         <span className="text-2xl font-black text-red-600 dark:text-red-400 mb-1 relative z-10 drop-shadow-sm">
                             {fmt(financialData.totalExpenses)}
                         </span>
                         <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10 border-b border-red-200 dark:border-red-800 pb-2 w-full mb-2">Total Operating Spend</span>
                         <div className="text-xs font-bold text-red-800 dark:text-red-300 w-full flex justify-between">
                             <span>Recorded Expenses</span>
                             <span>{expenseCount}</span>
                         </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        Manage Expenses
                    </div>
                </div>

                {/* Accounts Payable */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsPayablesOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsPayablesOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Wallet size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Accounts Payable</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                         <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02]">
                             <Wallet size={100} />
                         </div>
                         <span className="text-3xl font-black text-amber-600 mb-1 relative z-10 drop-shadow-sm">$0.00</span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10">Outstanding Bills</span>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        Vendor Payables
                    </div>
                </div>

                {/* Warranty Claims */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsWarrantyOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsWarrantyOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Shield size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Warranty Claims</h3>
                    </div>
                    <div className="space-y-3 flex-1 text-sm pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-indigo-500 flex justify-between items-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Credits Received</span>
                            <span className="font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded text-xs tracking-wide">
                                {fmt(warrantySummary.totalCredits)}
                            </span>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-indigo-300 flex justify-between items-center transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">Pending Claims</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700/50 px-2 py-1 rounded text-xs">
                                {warrantySummary.pending}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        Manage Claims
                    </div>
                </div>

                {/* Bank Payouts */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsPayoutsOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsPayoutsOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg group-hover:scale-110 transition-transform">
                            <DollarSign size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bank Payouts</h3>
                    </div>
                    <div className="space-y-3 flex-1 text-sm pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-teal-500 flex justify-between items-center transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Recent Payouts</span>
                            <span className="font-bold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30 px-2 py-1 rounded text-xs tracking-wide">
                                {payouts.length}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        View History
                    </div>
                </div>
                
                {/* Chargebacks & Disputes */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsDisputesOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsDisputesOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Shield size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Disputes</h3>
                    </div>
                    <div className="space-y-3 flex-1 text-sm pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-red-500 flex justify-between items-center transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Active Disputes</span>
                            <span className="font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs tracking-wide">
                                {disputes.length}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        Manage Disputes
                    </div>
                </div>
            </div>

            {/* Dashboard View Modals */}
            <Modal isOpen={isSalesOpen} onClose={() => setIsSalesOpen(false)} title="Sales Pipeline" size="full">
                <SalesPipeline />
            </Modal>
            <Modal isOpen={isPnLOpen} onClose={() => setIsPnLOpen(false)} title="Profit & Loss" size="full">
                <PnLTab financialData={financialData} setIsReportModalOpen={setIsReportModalOpen} />
            </Modal>
            <Modal isOpen={isInvoicesOpen} onClose={() => setIsInvoicesOpen(false)} title="Accounts Receivable" size="full">
                <InvoicesTab jobs={state.jobs} setEditingInvoiceId={setEditingInvoiceId} handleDeleteInvoice={setInvoiceToDelete} />
            </Modal>
            <Modal isOpen={isExpensesOpen} onClose={() => setIsExpensesOpen(false)} title="Expense Management" size="full">
                <ExpensesTab allExpenses={allExpenses} handleEditExpense={(exp) => { setEditingExpense(exp); setNewExpensePhotos(exp.receiptUrls || []); setNewExpense({ date: exp.date || new Date().toISOString().split('T')[0], category: exp.category || 'Materials', description: exp.description || exp.notes || '', amount: exp.amount || exp.cost || 0, vendor: exp.vendor || '', paidBy: exp.paidBy || state.currentUser?.firstName || 'Admin', projectId: exp.projectId || '' }); setIsExpenseModalOpen(true); }} handleDeleteExpense={async (id, type) => { await db.collection(type === 'vehicleLog' ? 'vehicleLogs' : 'expenses').doc(id).delete(); }} handleDeleteReceipt={async (id, type) => { await db.collection(type === 'vehicleLog' ? 'vehicleLogs' : 'expenses').doc(id).update({ receiptData: null, receiptUrl: null, receiptUrls: [] }); }} setViewingReceipt={setViewingReceipt} setIsExpenseModalOpen={setIsExpenseModalOpen} setNewExpense={setNewExpense} currentUser={state.currentUser} />
            </Modal>
            <Modal isOpen={isPayablesOpen} onClose={() => setIsPayablesOpen(false)} title="Accounts Payable" size="full">
                <Payables />
            </Modal>
            <Modal isOpen={isWarrantyOpen} onClose={() => setIsWarrantyOpen(false)} title="Warranty Claims Tracker" size="full">
                <WarrantyClaimsDashboard />
            </Modal>
            <Modal isOpen={isPayoutsOpen} onClose={() => setIsPayoutsOpen(false)} title="Bank Payouts" size="full">
                <PayoutsTab payouts={payouts} />
            </Modal>
            <Modal isOpen={isDisputesOpen} onClose={() => setIsDisputesOpen(false)} title="Chargebacks & Disputes" size="full">
                <DisputesTab disputes={disputes} />
            </Modal>
            <Modal isOpen={isAgingOpen} onClose={() => setIsAgingOpen(false)} title="A/R Aging Report" size="full">
                <AgingReportTab jobs={state.jobs} />
            </Modal>

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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="category-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category (Tax Classification)</label>
                            <select 
                                id="category-select"
                                aria-label="Category"
                                title="Category"
                                className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                value={newExpense.category}
                                onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                                required
                            >
                                <option value="Advertising">Advertising</option>
                                <option value="Car and truck expenses">Car and truck expenses</option>
                                <option value="Commissions and fees">Commissions and fees</option>
                                <option value="Contract labor">Contract labor</option>
                                <option value="Insurance">Insurance</option>
                                <option value="Legal and professional">Legal and professional</option>
                                <option value="Office expense">Office expense</option>
                                <option value="Rent or lease">Rent or lease</option>
                                <option value="Repairs and maintenance">Repairs and maintenance</option>
                                <option value="Supplies">Supplies</option>
                                <option value="Taxes and licenses">Taxes and licenses</option>
                                <option value="Travel">Travel</option>
                                <option value="Meals (50% deductible)">Meals (50% deductible)</option>
                                <option value="Utilities">Utilities</option>
                                <option value="Materials (COGS)">Materials (COGS)</option>
                                <option value="Other expenses">Other expenses</option>
                            </select>
                        </div>
                        <Input label="Description / Notes" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                    </div>
                    
                    <div>
                        <label htmlFor="inventory-item-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Attach to Inventory Item (Optional)</label>
                        <select 
                            id="inventory-item-select"
                            title="Attach to Inventory Item (Optional)"
                            aria-label="Attach to Inventory Item (Optional)"
                            className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white form-select"
                            value={newExpense.inventoryItemId || ''}
                            onChange={(e) => setNewExpense({ ...newExpense, inventoryItemId: e.target.value || null })}
                        >
                            <option value="">-- No Inventory Attached --</option>
                            {state.inventory?.map(inv => (
                                <option key={inv.id} value={inv.id}>{inv.name} (SKU: {inv.sku}) - {inv.quantity} in stock</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">If selected, this expense will automatically move to the job this inventory piece is consumed on.</p>
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Receipt Images (Optional)</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <Button type="button" variant="secondary" onClick={handleCaptureReceipt} className="flex items-center justify-center gap-2 py-2.5">
                                <CameraIcon size={16} /> Take Photo
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 py-2.5">
                                <Paperclip size={16} /> Upload Files
                            </Button>
                            <input 
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                                aria-label="Upload Receipts"
                                title="Upload Receipts"
                            />
                        </div>

                        {newExpensePhotos.length > 0 && (
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 transition-all">
                                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                        <Receipt size={14} />
                                        <span>{newExpensePhotos.length} {newExpensePhotos.length === 1 ? 'Page' : 'Pages'} Queued</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setNewExpensePhotos([])}
                                        className="text-red-500 hover:text-red-600 hover:underline flex items-center gap-1 transition-colors"
                                    >
                                        Clear All
                                    </button>
                                </div>

                                {isAnalyzing && (
                                    <div className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1.5 font-medium bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>AI Extracting Receipt Data...</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                                    {newExpensePhotos.map((photo, index) => (
                                        <div 
                                            key={index} 
                                            className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200"
                                        >
                                            <img 
                                                src={photo} 
                                                alt={`Receipt Page ${index + 1}`} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                            />
                                            <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-[2px] text-[10px] text-white px-1.5 py-0.5 rounded font-bold">
                                                p.${index + 1}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = [...newExpensePhotos];
                                                    updated.splice(index, 1);
                                                    setNewExpensePhotos(updated);
                                                }}
                                                className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full opacity-0 group-hover:opacity-100 shadow transition-opacity duration-200 flex items-center justify-center animate-fade-in"
                                                title="Delete Page"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <Button type="submit" disabled={isSubmittingExpense || isAnalyzing} className="w-full h-12 shadow-lg font-black uppercase">
                        {isSubmittingExpense ? 'Saving...' : 'Save Expense Record'}
                    </Button>
                </form>
            </Modal>

            <Modal isOpen={isCustomerSelectOpen} onClose={() => setIsCustomerSelectOpen(false)} title="Select Customer">
                <Input placeholder="Search customers..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
                <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                    <Button onClick={() => handleCreateInvoice()} variant="secondary" className="w-full text-xs font-bold mb-2">Create Blank Invoice</Button>
                    {state.customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase())).slice(0,10).map(c => (
                        <div 
                            key={c.id} 
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleCreateInvoice(c); e.preventDefault(); } }}
                            onClick={() => handleCreateInvoice(c)} 
                            className="p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold text-sm text-slate-900 dark:text-white"
                        >
                            {c.name}
                        </div>
                    ))}
                </div>
            </Modal>

            <Modal isOpen={!!viewingReceipt} onClose={() => { setViewingReceipt(null); setCurrentReceiptIndex(0); }} title="Receipt Preview">
                <div className="flex flex-col items-center gap-4">
                    {viewingReceipt && viewingReceipt.length > 0 && (
                        <div className="w-full flex flex-col items-center gap-2">
                            {viewingReceipt.length > 1 && (
                                <div className="flex items-center gap-4 text-slate-500 font-bold mb-2">
                                    <button 
                                        disabled={currentReceiptIndex === 0} 
                                        onClick={() => setCurrentReceiptIndex(c => c - 1)}
                                        className="p-2 disabled:opacity-30 hover:text-slate-900 dark:hover:text-white"
                                    >
                                        &larr; Prev
                                    </button>
                                    <span>Page {currentReceiptIndex + 1} of {viewingReceipt.length}</span>
                                    <button 
                                        disabled={currentReceiptIndex === viewingReceipt.length - 1} 
                                        onClick={() => setCurrentReceiptIndex(c => c + 1)}
                                        className="p-2 disabled:opacity-30 hover:text-slate-900 dark:hover:text-white"
                                    >
                                        Next &rarr;
                                    </button>
                                </div>
                            )}
                            <div className="flex justify-center bg-slate-900 p-2 md:p-4 rounded-2xl overflow-hidden max-h-[70vh] w-full">
                                <img 
                                    src={viewingReceipt[currentReceiptIndex] === 'embedded' ? 'https://placehold.co/400x400?text=Receipt+Not+Found' : viewingReceipt[currentReceiptIndex]} 
                                    className="max-w-full max-h-full object-contain rounded shadow-2xl" 
                                    alt={`Expense Receipt Page ${currentReceiptIndex + 1}`} 
                                    onError={(e) => {
                                        console.error("Receipt load failed", viewingReceipt[currentReceiptIndex]);
                                        (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Receipt+Not+Found';
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end w-full">
                        <Button onClick={() => { setViewingReceipt(null); setCurrentReceiptIndex(0); }} variant="secondary">Close</Button>
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

            {isReportModalOpen && (
                <DocumentPreview 
                    type="Other" 
                    data={{ 
                        id: `PNL-${Date.now()}`,
                        title: 'Profit & Loss Statement (Complete)',
                        customerName: state.currentOrganization?.name || 'Your Company',
                        htmlContent: `
                            <div style="font-family:sans-serif; max-width: 600px; margin: auto;">
                                <h2>Financial Executive Summary</h2>
                                <h3>Total Collected: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialData.totalCollected)}</h3>
                                <h3>Total Expenses: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialData.totalExpenses)}</h3>
                                <hr />
                                <h2>NET OPERATING INCOME: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialData.netIncome)}</h2>
                                <br/>
                                <h3>Expense Breakdown:</h3>
                                <ul>
                                    ${Object.entries(financialData.expenseCats).map(([cat, val]) => `<li><b>${cat}:</b> ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val as number)}</li>`).join('')}
                                </ul>
                            </div>
                        `
                    }} 
                    onClose={() => setIsReportModalOpen(false)} 
                />
            )}
        </div>
    );
};

export default Financials;
