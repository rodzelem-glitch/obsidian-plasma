import showToast from "lib/toast";

import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../../components/ui/Button';
import InvoiceEditorModal from '../../components/modals/InvoiceEditorModal';
import SelectExistingJobModal from '../../components/modals/SelectExistingJobModal';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import {
    Download, Calendar, Filter, FileText, TrendingUp, TrendingDown,
    MoreHorizontal, DollarSign, Wallet, ArrowUpRight, ArrowDownRight,
    PieChart, Briefcase, Calculator, Plus, User, Search, Paperclip, Users, Shield,
    Loader2, Trash2, Receipt, Camera as CameraIcon, Scale
} from 'lucide-react';
import { db, functions, firebase } from '../../lib/firebase';
import { getNextInvoiceNumber } from 'lib/numbering';
import { cleanUndefinedFields } from 'lib/utils';
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
import SalesTaxPrepTab from './financials/components/SalesTaxPrepTab';

const Financials: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const navigate = useNavigate();
    
    const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'franchise_admin';

    const [view, setView] = useState<'overview' | 'pnl' | 'invoices' | 'expenses' | 'sales' | 'accounting' | 'aging' | 'salestax' | 'payroll' | 'payables'>('overview');
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({ date: new Date().toISOString().split('T')[0], category: 'Materials', description: '', amount: 0, subtotal: 0, taxAmount: 0, vendor: '', paidBy: state.currentUser?.firstName || 'Admin', projectId: '', expenseType: 'business' });
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
    
    // Existing Job Interception States
    const [selectedCustomerForExisting, setSelectedCustomerForExisting] = useState<Customer | null>(null);
    const [existingJobsForCustomer, setExistingJobsForCustomer] = useState<Job[]>([]);
    const [isExistingJobModalOpen, setIsExistingJobModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
    const [pnlStartDate, setPnlStartDate] = useState<string>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [pnlEndDate, setPnlEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [pnlPreset, setPnlPreset] = useState<string>('this_month');
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
    const [isSalesTaxOpen, setIsSalesTaxOpen] = useState(false);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [disputes, setDisputes] = useState<any[]>([]);
    const [payables, setPayables] = useState<any[]>([]);

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

        const unsubPayables = db.collection('payables')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snap => {
                const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPayables(results);
            }, err => console.error("Failed to load payables", err));

        return () => {
            unsub();
            unsubDisputes();
            unsubPayables();
        };
    }, [state.currentOrganization?.id]);

    // Ensure we handle URL params opening specific modals
    React.useEffect(() => {
        const tab = searchParams.get('tab');
        const invId = searchParams.get('invoiceId');
        const expId = searchParams.get('expId');
        if (tab === 'salestax' || tab === 'tax') {
            setIsSalesTaxOpen(true);
        } else if (tab === 'invoices' && invId) {
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
                        const parsedTotal = extracted.amount ? parseFloat(extracted.amount) : 0;
                        const parsedTax = extracted.taxAmount ? parseFloat(extracted.taxAmount) : 0;
                        const parsedSubtotal = extracted.subtotal ? parseFloat(extracted.subtotal) : (parsedTotal ? Math.max(0, parsedTotal - parsedTax) : 0);

                        setNewExpense(prev => ({
                            ...prev,
                            vendor: prev.vendor ? prev.vendor : (extracted.vendor || prev.vendor),
                            amount: prev.amount && prev.amount !== 0 ? prev.amount : (parsedTotal || (parsedSubtotal + parsedTax)),
                            subtotal: prev.subtotal && prev.subtotal !== 0 ? prev.subtotal : parsedSubtotal,
                            taxAmount: prev.taxAmount && prev.taxAmount !== 0 ? prev.taxAmount : parsedTax,
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
                            const parsedTotal = extracted.amount ? parseFloat(extracted.amount) : 0;
                            const parsedTax = extracted.taxAmount ? parseFloat(extracted.taxAmount) : 0;
                            const parsedSubtotal = extracted.subtotal ? parseFloat(extracted.subtotal) : (parsedTotal ? Math.max(0, parsedTotal - parsedTax) : 0);

                            setNewExpense(prev => ({
                                ...prev,
                                vendor: prev.vendor ? prev.vendor : (extracted.vendor || prev.vendor),
                                amount: prev.amount && prev.amount !== 0 ? prev.amount : (parsedTotal || (parsedSubtotal + parsedTax)),
                                subtotal: prev.subtotal && prev.subtotal !== 0 ? prev.subtotal : parsedSubtotal,
                                taxAmount: prev.taxAmount && prev.taxAmount !== 0 ? prev.taxAmount : parsedTax,
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
        const payableExp = payables
            .filter(p => p.status === 'Paid')
            .map(p => ({
                id: p.id,
                organizationId: p.organizationId,
                date: (p.paidAt || p.createdAt || '').split('T')[0],
                category: 'Subcontractor Cost',
                description: `Payout to subcontractor ${p.companyName} for customer ${p.customerName}`,
                amount: Number(p.amount) || 0,
                vendor: p.companyName,
                paidBy: 'Admin',
                type: 'payable',
                sourceId: p.id
            }));
        return [...expenses, ...vLogs, ...payableExp].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.expenses, state.vehicleLogs, payables]);

    const financialData = useMemo(() => {
        const isDateInRange = (dateStr: string | undefined) => {
            if (!dateStr) return false;
            const dateOnly = dateStr.split('T')[0];
            return (!pnlStartDate || dateOnly >= pnlStartDate) && (!pnlEndDate || dateOnly <= pnlEndDate);
        };

        const totalBilled = state.jobs
            .filter((j: any) => j.invoice && isDateInRange(j.appointmentTime))
            .reduce((sum: number, j: any) => sum + (Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0), 0);

        let totalCollected = 0;
        state.jobs.forEach((j: any) => {
            if (!j.invoice) return;
            const inv = j.invoice;
            const collectedDate = inv.paidDate || j.appointmentTime;
            if (isDateInRange(collectedDate)) {
                const amount = Number(inv.amountPaid) || (inv.status === 'Paid' ? (Number(inv.totalAmount) || Number(inv.amount) || 0) : 0);
                totalCollected += amount;
            }
        });
        
        const warrantyRevenue = (state.warrantyClaims || [])
            .filter((c: any) => c.status === 'Credit Received' && isDateInRange(c.updatedAt || c.createdAt || c.claimDate))
            .reduce((sum: number, c: any) => sum + (Number(c.amountApproved) || 0), 0);
            
        totalCollected += warrantyRevenue;
        const totalBilledWithWarranty = totalBilled + warrantyRevenue;
        
        const receivables = totalBilledWithWarranty - totalCollected;
        
        const filteredExpenses = allExpenses.filter((e: any) => isDateInRange(e.date));
        const businessExpenses = filteredExpenses.filter((e: any) => e.expenseType !== 'personal');
        const totalPersonalExpenses = filteredExpenses
            .filter((e: any) => e.expenseType === 'personal')
            .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

        const totalExpenses = businessExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        const expenseCats: Record<string, number> = {};
        businessExpenses.forEach((e: any) => { expenseCats[e.category] = (expenseCats[e.category] || 0) + (Number(e.amount) || 0); });
        const netIncome = totalCollected - totalExpenses;
        
        return { totalBilled: totalBilledWithWarranty, totalCollected, receivables, totalExpenses, netIncome, expenseCats, totalPersonalExpenses };
    }, [state.jobs, allExpenses, state.warrantyClaims, pnlStartDate, pnlEndDate]);


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
                    await db.collection('vehicleLogs').doc(editingExpense.id).update(cleanUndefinedFields({ 
                        date: newExpense.date, 
                        cost: Number(newExpense.amount), 
                        notes: newExpense.description, 
                        receiptData: null,
                        receiptUrl: finalReceiptData,
                        receiptUrls: finalReceiptUrls,
                        ...auditData
                    })); 
                } else { 
                    await db.collection('expenses').doc(editingExpense.id).update(cleanUndefinedFields({ 
                        date: newExpense.date, 
                        category: newExpense.category, 
                        description: newExpense.description, 
                        amount: Number(newExpense.amount), 
                        subtotal: Number(newExpense.subtotal || 0),
                        taxAmount: Number(newExpense.taxAmount || 0),
                        vendor: newExpense.vendor, 
                        paidBy: newExpense.paidBy, 
                        projectId: newExpense.projectId || null, 
                        inventoryItemId: newExpense.inventoryItemId || null,
                        expenseType: newExpense.expenseType || 'business',
                        receiptData: null,
                        receiptUrl: finalReceiptData,
                        receiptUrls: finalReceiptUrls,
                        ...auditData
                    })); 
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
                    subtotal: Number(newExpense.subtotal || 0),
                    taxAmount: Number(newExpense.taxAmount || 0),
                    vendor: newExpense.vendor,
                    paidBy: newExpense.paidBy,
                    projectId: newExpense.projectId,
                    inventoryItemId: newExpense.inventoryItemId || null,
                    expenseType: newExpense.expenseType || 'business',
                    receiptData: null,
                    receiptUrl: finalReceiptData,
                    receiptUrls: finalReceiptUrls,
                    createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
                    createdById: editingExpense ? editingExpense.createdById : state.currentUser.id,
                    createdByName: editingExpense ? editingExpense.createdByName : `${state.currentUser.firstName} ${state.currentUser.lastName}`,
                    ...auditData
                };
                if (editingExpense) {
                    await db.collection('expenses').doc(exp.id).update(cleanUndefinedFields(exp));
                } else {
                    await db.collection('expenses').doc(exp.id).set(cleanUndefinedFields(exp));
                }
            }
            setNewExpensePhotos([]);
            setIsExpenseModalOpen(false);
        } catch (error) { showToast.warn("Error saving expense."); } finally { setIsSubmittingExpense(false); }
    };

    const proceedCreateInvoice = async (customer?: Customer) => {
        if (!state.currentUser) return;
        setIsCreatingInvoice(true); 
        setIsCustomerSelectOpen(false);
        setIsExistingJobModalOpen(false);

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
            createdAt: new Date().toISOString(),
            createdById: state.currentUser?.id || state.currentUser?.uid || null,
            createdByName: state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() || 'Admin' : 'System Admin',
            updatedAt: new Date().toISOString(),
            updatedById: state.currentUser?.id || state.currentUser?.uid || null,
            updatedByName: state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() || 'Admin' : 'System Admin',
            address: customer?.address || { street: 'N/A', city: 'N/A', state: 'N/A', zip: 'N/A' }, 
            specialInstructions: 'N/A' 
        };
        try {
            await db.collection('jobs').doc(id).set(cleanUndefinedFields(newJob));
            setEditingInvoiceId(id);
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to create invoice.");
        } finally {
            setIsCreatingInvoice(false);
        }
    };

    const handleCreateInvoice = async (customer?: Customer) => {
        if (!customer) {
            await proceedCreateInvoice(undefined);
            return;
        }

        const customerJobs = state.jobs.filter(j => 
            j.customerId === customer.id && 
            !j.archived && 
            !j.deleted && 
            (!j.invoice || j.invoice.status !== 'Paid')
        );

        if (customerJobs.length > 0) {
            setIsCustomerSelectOpen(false);
            setSelectedCustomerForExisting(customer);
            setExistingJobsForCustomer(customerJobs);
            setIsExistingJobModalOpen(true);
        } else {
            await proceedCreateInvoice(customer);
        }
    };

    const handleSelectExistingJob = (job: Job) => {
        setIsExistingJobModalOpen(false);
        setEditingInvoiceId(job.id);
    };

    const confirmDeleteInvoice = async () => {
        if (invoiceToDelete) {
            await db.collection('jobs').doc(invoiceToDelete).update(cleanUndefinedFields({
                deleted: true,
                deletedAt: new Date().toISOString(),
                expireAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000))
            }));
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

            await db.collection(type === 'vehicleLog' ? 'vehicleLogs' : 'expenses').doc(id).update(cleanUndefinedFields({
                receiptData: null,
                receiptUrl: downloadUrl,
                updatedAt: new Date().toISOString(),
                updatedById: state.currentUser.id,
                updatedByName: `${state.currentUser.firstName} ${state.currentUser.lastName}`
            }));
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
    const allTimeReceivables = useMemo(() => {
        return state.jobs
            .filter((j: any) => j.invoice && j.invoice.status !== 'Paid')
            .reduce((sum: number, j: any) => {
                const total = Number(j.invoice.totalAmount) || Number(j.invoice.amount) || 0;
                const paid = Number(j.invoice.amountPaid) || 0;
                return sum + Math.max(0, total - paid);
            }, 0);
    }, [state.jobs]);

    const pendingInvoices = useMemo(() => {
        return state.jobs.filter((j: any) => j.invoice && j.invoice.status !== 'Paid').length;
    }, [state.jobs]);

    const outstandingPayables = useMemo(() => {
        return payables
            .filter(p => p.status === 'Unpaid')
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }, [payables]);

    const salesMetrics = useMemo(() => {
        const proposals = state.proposals || [];
        const count = proposals.length;
        const acceptedCount = proposals.filter((p: any) => p.status === 'Accepted').length;
        const closeRate = count > 0 ? (acceptedCount / count) * 100 : 0;
        return { closeRate, count };
    }, [state.proposals]);

    const filteredExpensesCount = useMemo(() => {
        const isDateInRange = (dateStr: string | undefined) => {
            if (!dateStr) return false;
            const dateOnly = dateStr.split('T')[0];
            return (!pnlStartDate || dateOnly >= pnlStartDate) && (!pnlEndDate || dateOnly <= pnlEndDate);
        };
        return allExpenses.filter((e: any) => isDateInRange(e.date)).length;
    }, [allExpenses, pnlStartDate, pnlEndDate]);

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
                    <Button onClick={() => navigate('/admin/proposal')} className="bg-purple-600 shadow-lg text-xs font-black uppercase">+ {t("Proposal")}</Button>
                    <Button onClick={() => setIsCustomerSelectOpen(true)} className="bg-emerald-600 shadow-lg text-xs font-black uppercase">+ {t("Invoice")}</Button>
                    <Button onClick={() => { setEditingExpense(null); setIsExpenseModalOpen(true); }} className="bg-blue-600 shadow-lg text-xs font-black uppercase">+ {t("Expense")}</Button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-0">
                
                {/* Proposals */}
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Proposals")}</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                         <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02]">
                             <Briefcase size={100} />
                         </div>
                         <div className="w-full px-4 space-y-3 relative z-10">
                             <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                                 <span>{t("Estimate Conversion")}</span>
                                 <span className="text-purple-600 dark:text-purple-400">{salesMetrics.closeRate.toFixed(1)}%</span>
                             </div>
                             <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                 <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${salesMetrics.closeRate}%` }}></div>
                             </div>
                         </div>
                     </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        {t("View Pipeline")}
                    </div>
                </div>

                {/* Project Proposals */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { navigate('/admin/project-proposals'); e.preventDefault(); } }}
                    onClick={() => navigate('/admin/project-proposals')}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:scale-110 transition-transform">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Project Proposals")}</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                         <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02]">
                             <FileText size={100} />
                         </div>
                         <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mb-1 relative z-10 drop-shadow-sm">
                             {(state.proposals || []).filter((p: any) => p.isProjectLevel).length}
                         </span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10">{t("Commercial Bids")}</span>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        {t("Manage Project Proposals")}
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Profit & Loss")}</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-gray-800 rounded-lg border border-blue-100 dark:border-blue-900/30">
                         <span className={`text-3xl font-black ${financialData.netIncome >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'} mb-1 relative z-10 drop-shadow-sm`}>
                             {fmt(financialData.netIncome)}
                         </span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10">{t("Net Profit")}</span>
                         <div className="mt-2 text-[10px] font-black text-white bg-blue-500 px-2 py-0.5 rounded shadow">
                             {pnlMargin.toFixed(1)}% {t("MARGIN")}
                         </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        {t("View P&L Report")}
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Accounts Receivable")}</h3>
                    </div>
                    <div className="space-y-3 flex-1 text-sm pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-emerald-500 flex justify-between items-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">{t("Overdue / Unpaid")}</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded text-xs tracking-wide">
                                {fmt(allTimeReceivables)}
                            </span>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-emerald-300 flex justify-between items-center transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">{t("Pending Invoices")}</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700/50 px-2 py-1 rounded text-xs">
                                {pendingInvoices}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        {t("Manage Invoices")}
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("A/R Aging Report")}</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                         <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02]">
                             <TrendingUp size={100} />
                         </div>
                         <span className="text-3xl font-black text-amber-600 mb-1 relative z-10 drop-shadow-sm">{fmt(allTimeReceivables)}</span>
                         <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10">{t("Total Overdue")}</span>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        {t("View Aging Summary")}
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Expense Tracking")}</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30 text-center px-4">
                         <span className="text-2xl font-black text-red-600 dark:text-red-400 mb-1 relative z-10 drop-shadow-sm">
                             {fmt(financialData.totalExpenses)}
                         </span>
                         <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10 border-b border-red-200 dark:border-red-800 pb-2 w-full mb-2">{t("Total Operating Spend")}</span>
                         <div className="text-xs font-bold text-red-800 dark:text-red-300 w-full flex justify-between">
                             <span>{t("Recorded Expenses")}</span>
                             <span>{filteredExpensesCount}</span>
                         </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        {t("Manage Expenses")}
                    </div>
                </div>

                {/* Accounts Payable - Admin Only */}
                {isAdmin && (
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
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Accounts Payable")}</h3>
                        </div>
                        <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                             <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] dark:opacity-[0.02]">
                                 <Wallet size={100} />
                             </div>
                             <span className="text-3xl font-black text-amber-600 mb-1 relative z-10 drop-shadow-sm">{fmt(outstandingPayables)}</span>
                             <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10">{t("Outstanding Bills")}</span>
                        </div>
                        <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                            {t("Vendor Payables")}
                        </div>
                    </div>
                )}

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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Warranty Claims")}</h3>
                    </div>
                    <div className="space-y-3 flex-1 text-sm pt-2">
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-indigo-500 flex justify-between items-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">{t("Credits Received")}</span>
                            <span className="font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded text-xs tracking-wide">
                                {fmt(warrantySummary.totalCredits)}
                            </span>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-indigo-300 flex justify-between items-center transition-colors">
                            <span className="text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">{t("Pending Claims")}</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700/50 px-2 py-1 rounded text-xs">
                                {warrantySummary.pending}
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        {t("Manage Claims")}
                    </div>
                </div>

                {/* Bank Payouts - Admin Only */}
                {isAdmin && (
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
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Bank Payouts")}</h3>
                        </div>
                        <div className="space-y-3 flex-1 text-sm pt-2">
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-teal-500 flex justify-between items-center transition-colors">
                                <span className="text-gray-600 dark:text-gray-400 font-medium">{t("Recent Payouts")}</span>
                                <span className="font-bold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30 px-2 py-1 rounded text-xs tracking-wide">
                                    {payouts.length}
                                </span>
                            </div>
                        </div>
                        <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                            {t("View History")}
                        </div>
                    </div>
                )}
                
                {/* Chargebacks & Disputes - Admin Only */}
                {isAdmin && (
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
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Disputes")}</h3>
                        </div>
                        <div className="space-y-3 flex-1 text-sm pt-2">
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-red-500 flex justify-between items-center transition-colors">
                                <span className="text-gray-600 dark:text-gray-400 font-medium">{t("Active Disputes")}</span>
                                <span className="font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs tracking-wide">
                                    {disputes.length}
                                </span>
                            </div>
                        </div>
                        <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                            {t("Manage Disputes")}
                        </div>
                    </div>
                )}

                {/* Texas Sales Tax & Filing Prep Card */}
                <div 
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setIsSalesTaxOpen(true); e.preventDefault(); } }}
                    onClick={() => setIsSalesTaxOpen(true)}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 flex flex-col group overflow-hidden text-left"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                            <Scale size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t("Texas Sales Tax Prep")}</h3>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-center px-4">
                         <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-1 relative z-10 drop-shadow-sm">
                             {fmt(financialData.totalCollected * ((state.currentOrganization?.taxRate || 8.25) / 100))}
                         </span>
                         <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-widest relative z-10 border-b border-emerald-200 dark:border-emerald-800 pb-2 w-full mb-2">Est. Tax Collected</span>
                         <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 w-full flex justify-between">
                             <span>WebFile Form 01-114</span>
                             <span>{state.currentOrganization?.taxRate || 8.25}%</span>
                         </div>
                    </div>
                    <div className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex w-full justify-center border-t border-gray-100 dark:border-gray-700 pt-3 relative z-10">
                        {t("Texas Filing Mode")}
                    </div>
                </div>
            </div>

            {/* Dashboard View Modals */}
            <Modal isOpen={isSalesOpen} onClose={() => setIsSalesOpen(false)} title={t("Proposals")} size="full">
                <SalesPipeline />
            </Modal>
            <Modal isOpen={isPnLOpen} onClose={() => setIsPnLOpen(false)} title={t("Profit & Loss")} size="full">
                <PnLTab 
                    financialData={financialData} 
                    setIsReportModalOpen={setIsReportModalOpen} 
                    startDate={pnlStartDate}
                    endDate={pnlEndDate}
                    setStartDate={setPnlStartDate}
                    setEndDate={setPnlEndDate}
                    preset={pnlPreset}
                    setPreset={setPnlPreset}
                />
            </Modal>
            <Modal isOpen={isInvoicesOpen} onClose={() => setIsInvoicesOpen(false)} title={t("Accounts Receivable")} size="full">
                <InvoicesTab jobs={state.jobs} setEditingInvoiceId={setEditingInvoiceId} handleDeleteInvoice={setInvoiceToDelete} isAdmin={isAdmin} />
            </Modal>
            <Modal isOpen={isExpensesOpen} onClose={() => setIsExpensesOpen(false)} title={t("Expense Management")} size="full">
                <ExpensesTab allExpenses={allExpenses} handleEditExpense={(exp) => { setEditingExpense(exp); setNewExpensePhotos(exp.receiptUrls || []); setNewExpense({ date: exp.date || new Date().toISOString().split('T')[0], category: exp.category || 'Materials', description: exp.description || exp.notes || '', amount: exp.amount || exp.cost || 0, subtotal: exp.subtotal || 0, taxAmount: exp.taxAmount || 0, vendor: exp.vendor || '', paidBy: exp.paidBy || state.currentUser?.firstName || 'Admin', projectId: exp.projectId || '', expenseType: exp.expenseType || 'business' }); setIsExpenseModalOpen(true); }} handleDeleteExpense={async (id, type) => { await db.collection(type === 'vehicleLog' ? 'vehicleLogs' : 'expenses').doc(id).delete(); }} handleDeleteReceipt={async (id, type) => { await db.collection(type === 'vehicleLog' ? 'vehicleLogs' : 'expenses').doc(id).update(cleanUndefinedFields({ receiptData: null, receiptUrl: null, receiptUrls: [] })); }} setViewingReceipt={setViewingReceipt} setIsExpenseModalOpen={setIsExpenseModalOpen} setNewExpense={setNewExpense} currentUser={state.currentUser} isAdmin={isAdmin} />
            </Modal>
            <Modal isOpen={isPayablesOpen} onClose={() => setIsPayablesOpen(false)} title={t("Accounts Payable")} size="full">
                <Payables />
            </Modal>
            <Modal isOpen={isWarrantyOpen} onClose={() => setIsWarrantyOpen(false)} title={t("Warranty Claims Tracker")} size="full">
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
            <Modal isOpen={isSalesTaxOpen} onClose={() => setIsSalesTaxOpen(false)} title="State Sales & Use Tax Filing Prep" size="full">
                <SalesTaxPrepTab jobs={state.jobs} orgTaxRate={state.currentOrganization?.taxRate || 8.25} orgName={state.currentOrganization?.name || 'Your Company'} />
            </Modal>

            {editingInvoiceId && <InvoiceEditorModal isOpen={true} onClose={() => setEditingInvoiceId(null)} jobId={editingInvoiceId} />}
            
            <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Manage Expense">
                <form onSubmit={handleSaveExpense} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-1">
                            <Input label="Date" type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} required />
                        </div>
                        <div className="sm:col-span-1">
                            <Input 
                                label="Subtotal ($)" 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00"
                                value={newExpense.subtotal === undefined || isNaN(newExpense.subtotal) ? '' : newExpense.subtotal} 
                                onChange={e => {
                                    const sub = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    const tax = newExpense.taxAmount || 0;
                                    setNewExpense({ ...newExpense, subtotal: sub, amount: parseFloat((sub + tax).toFixed(2)) });
                                }} 
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <Input 
                                label="Tax Paid ($)" 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00"
                                value={newExpense.taxAmount === undefined || isNaN(newExpense.taxAmount) ? '' : newExpense.taxAmount} 
                                onChange={e => {
                                    const tax = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    const sub = newExpense.subtotal || Math.max(0, (newExpense.amount || 0) - tax);
                                    setNewExpense({ ...newExpense, taxAmount: tax, subtotal: sub, amount: parseFloat((sub + tax).toFixed(2)) });
                                }} 
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <Input 
                                label="Total ($)" 
                                type="number" 
                                step="0.01" 
                                placeholder="0.00"
                                value={isNaN(newExpense.amount!) ? '' : newExpense.amount} 
                                onChange={e => {
                                    const tot = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    const tax = newExpense.taxAmount || 0;
                                    const sub = Math.max(0, tot - tax);
                                    setNewExpense({ ...newExpense, amount: tot, subtotal: parseFloat(sub.toFixed(2)) });
                                }} 
                                required 
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="expense-type-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expense Type</label>
                            <select 
                                id="expense-type-select"
                                aria-label="Expense Type"
                                title="Expense Type"
                                className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                value={newExpense.expenseType || 'business'}
                                onChange={e => setNewExpense({...newExpense, expenseType: e.target.value as 'business' | 'personal'})}
                                required
                            >
                                <option value="business">Business Expense</option>
                                <option value="personal">Personal Expense</option>
                            </select>
                        </div>
                        <Input label="Vendor" value={newExpense.vendor} onChange={e => setNewExpense({...newExpense, vendor: e.target.value})} required />
                    </div>
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
                    {state.customers.filter(c => {
                        const searchLower = custSearch.toLowerCase();
                        const matchesName = c.name.toLowerCase().includes(searchLower);
                        const matchesLocation = c.serviceLocations?.some(loc => 
                            (loc.propertyName || '').toLowerCase().includes(searchLower) ||
                            (loc.address || '').toLowerCase().includes(searchLower)
                        );
                        return matchesName || matchesLocation;
                    }).slice(0,10).map(c => {
                        const searchLower = custSearch.toLowerCase();
                        const matchingLoc = custSearch ? c.serviceLocations?.find(loc => 
                            (loc.propertyName || '').toLowerCase().includes(searchLower) ||
                            (loc.address || '').toLowerCase().includes(searchLower)
                        ) : null;
                        const locName = matchingLoc ? (matchingLoc.propertyName || matchingLoc.address) : null;

                        return (
                            <div 
                                key={c.id} 
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleCreateInvoice(c); e.preventDefault(); } }}
                                onClick={() => handleCreateInvoice(c)} 
                                className="p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold text-sm text-slate-900 dark:text-white"
                            >
                                <div>{c.name}</div>
                                {locName && (
                                    <div className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                                        Matches location: {locName}
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
                            <div className="flex justify-center bg-slate-900 p-2 md:p-4 rounded-2xl overflow-hidden max-h-[70vh] w-full min-h-[400px]">
                                {(() => {
                                    const url = viewingReceipt[currentReceiptIndex];
                                    const isHtml = url?.startsWith('data:text/html') || url?.includes('.html');
                                    if (isHtml) {
                                        let srcDoc = url;
                                        if (url.startsWith('data:text/html;base64,')) {
                                            try {
                                                srcDoc = decodeURIComponent(escape(atob(url.split('base64,')[1])));
                                            } catch (err) {
                                                console.error("Failed to decode receipt base64 HTML:", err);
                                            }
                                        }
                                        return (
                                            <iframe 
                                                srcDoc={srcDoc} 
                                                className="w-full h-[60vh] bg-white rounded-xl border-none"
                                                title="Receipt Document"
                                            />
                                        );
                                    }
                                    return (
                                        <img 
                                            src={url === 'embedded' ? 'https://placehold.co/400x400?text=Receipt+Not+Found' : url} 
                                            className="max-w-full max-h-full object-contain rounded shadow-2xl" 
                                            alt={`Expense Receipt Page ${currentReceiptIndex + 1}`} 
                                            onError={(e) => {
                                                console.error("Receipt load failed", url);
                                                (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Receipt+Not+Found';
                                            }}
                                        />
                                    );
                                })()}
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

            {isReportModalOpen && (() => {
                const warrantyRevenue = (state.warrantyClaims || [])
                    .filter((c: any) => c.status === 'Credit Received' && (!pnlStartDate || (c.updatedAt || c.createdAt || c.claimDate || '').split('T')[0] >= pnlStartDate) && (!pnlEndDate || (c.updatedAt || c.createdAt || c.claimDate || '').split('T')[0] <= pnlEndDate))
                    .reduce((sum: number, c: any) => sum + (Number(c.amountApproved) || 0), 0);
                const jobRevenue = financialData.totalCollected - warrantyRevenue;
                return (
                    <DocumentPreview 
                        type="Other" 
                        data={{ 
                            id: `PNL-${Date.now()}`,
                            title: 'Profit & Loss Statement',
                            customerName: state.currentOrganization?.name || 'Your Company',
                            htmlContent: `
                                <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 750px; margin: 10px auto; padding: 30px; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px;">
                                    <!-- Header -->
                                    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
                                        <div>
                                            <h1 style="font-size: 22px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin: 0 0 2px 0; letter-spacing: -0.025em;">${state.currentOrganization?.name || 'Your Company'}</h1>
                                            <p style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; margin: 0; letter-spacing: 0.05em;">Corporate Financial Statement</p>
                                        </div>
                                        <div style="text-align: right;">
                                            <h2 style="font-size: 16px; font-weight: 900; color: #2563eb; text-transform: uppercase; margin: 0 0 2px 0; letter-spacing: 0.05em;">Profit & Loss Statement</h2>
                                            <p style="font-size: 11px; color: #64748b; font-weight: 500; margin: 0;">Period: ${pnlStartDate ? new Date(pnlStartDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : 'All Time'} &ndash; ${pnlEndDate ? new Date(pnlEndDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : 'Today'}</p>
                                        </div>
                                    </div>

                                    <!-- Table -->
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px;">
                                        <thead>
                                            <tr style="border-bottom: 1.5px solid #cbd5e1; text-align: left;">
                                                <th style="padding: 8px 0; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Accounts & Classifications</th>
                                                <th style="padding: 8px 0; text-align: right; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; width: 150px;">Debit / Credit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <!-- REVENUES -->
                                            <tr style="background-color: #f8fafc; font-weight: 800;">
                                                <td style="padding: 6px 8px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.025em;">Revenues & Direct Income</td>
                                                <td></td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                                <td style="padding: 6px 16px; color: #475569;">Job & Field Service Revenue</td>
                                                <td style="padding: 6px 8px; text-align: right; font-weight: 600; color: #334155;">${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(jobRevenue)}</td>
                                            </tr>
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                                <td style="padding: 6px 16px; color: #475569;">Warranty Claim Credit Recoveries</td>
                                                <td style="padding: 6px 8px; text-align: right; font-weight: 600; color: #334155;">${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(warrantyRevenue)}</td>
                                            </tr>
                                            <tr style="border-bottom: 2px solid #cbd5e1; font-weight: 700;">
                                                <td style="padding: 8px 16px; color: #0f172a;">Total Income / Revenue</td>
                                                <td style="padding: 8px 8px; text-align: right; color: #0f172a; border-bottom: 1px solid #0f172a;">${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialData.totalCollected)}</td>
                                            </tr>

                                            <!-- SPACE -->
                                            <tr><td colspan="2" style="padding: 8px 0;"></td></tr>

                                            <!-- OPERATING EXPENSES -->
                                            <tr style="background-color: #f8fafc; font-weight: 800;">
                                                <td style="padding: 6px 8px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.025em;">Operating Expenses</td>
                                                <td></td>
                                            </tr>
                                            ${Object.entries(financialData.expenseCats).map(([cat, val]) => `
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                                <td style="padding: 5px 16px; color: #475569;">${cat}</td>
                                                <td style="padding: 5px 8px; text-align: right; color: #64748b; font-weight: 500;">${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val as number)}</td>
                                            </tr>
                                            `).join('')}
                                            <tr style="border-bottom: 2px solid #cbd5e1; font-weight: 700;">
                                                <td style="padding: 8px 16px; color: #0f172a;">Total Operating Expenses</td>
                                                <td style="padding: 8px 8px; text-align: right; color: #0f172a; border-bottom: 1px solid #0f172a;">(${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialData.totalExpenses)})</td>
                                            </tr>

                                            <!-- SPACE -->
                                            <tr><td colspan="2" style="padding: 12px 0;"></td></tr>

                                            <!-- NET INCOME -->
                                            <tr style="font-weight: 900; font-size: 13px; background-color: #f1f5f9;">
                                                <td style="padding: 10px 8px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Net Operating Income</td>
                                                <td style="padding: 10px 8px; text-align: right; color: ${financialData.netIncome >= 0 ? '#16a34a' : '#dc2626'}; border-bottom: 4px double #0f172a; font-size: 14px;">
                                                    ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financialData.netIncome)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <!-- Footer -->
                                    <div style="margin-top: 40px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">
                                        Generated Securely &bull; TekTrakker Professional Accounting &bull; Confidential
                                    </div>
                                </div>
                            `
                        }} 
                        onClose={() => setIsReportModalOpen(false)} 
                    />
                );
            })()}

            {isExistingJobModalOpen && selectedCustomerForExisting && (
                <SelectExistingJobModal
                    isOpen={isExistingJobModalOpen}
                    onClose={() => {
                        setIsExistingJobModalOpen(false);
                        setSelectedCustomerForExisting(null);
                        setExistingJobsForCustomer([]);
                    }}
                    customer={selectedCustomerForExisting}
                    jobs={existingJobsForCustomer}
                    onSelectJob={handleSelectExistingJob}
                    onCreateNew={() => proceedCreateInvoice(selectedCustomerForExisting)}
                />
            )}
        </div>
    );
};

export default Financials;
