/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import showToast from "lib/toast";

import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { Edit, Trash2, Paperclip, Camera as CameraIcon, Image as ImageIcon, Share2, Copy, Calculator, Download, FileText, Search } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { useAppContext } from 'context/AppContext';
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import { db } from 'lib/firebase';

interface ExpensesTabProps {
    allExpenses: any[];
    handleEditExpense: (exp: any) => void;
    handleDeleteExpense: (id: string, type: string) => void;
    handleDeleteReceipt: (id: string, type: string) => void;
    setViewingReceipt: (urls: string[]) => void;
    setIsExpenseModalOpen: (val: boolean) => void;
    setNewExpense: (val: any) => void;
    currentUser: any;
}

const ExpensesTab: React.FC<ExpensesTabProps> = ({
    allExpenses,
    handleEditExpense,
    handleDeleteExpense,
    handleDeleteReceipt,
    setViewingReceipt,
    setIsExpenseModalOpen,
    setNewExpense,
    currentUser
}) => {
    const { state } = useAppContext();
    const [shareModalExp, setShareModalExp] = useState<any>(null);
    const [shareTargetId, setShareTargetId] = useState<string>('');
    const [shareMessageText, setShareMessageText] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const handleCopyRef = (expId: string) => {
        navigator.clipboard.writeText(`#EXP-${expId}`);
        showToast.warn("Expense Reference Copied! Paste it anywhere to create a smart link.");
    };

    const handleShareExpense = async () => {
        if (!shareModalExp || !shareTargetId) return;
        setIsSharing(true);
        try {
            const msgObj: any = {
                id: `msg-${Date.now()}`,
                senderId: state.currentUser?.id,
                senderName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                receiverId: shareTargetId,
                content: `${shareMessageText ? shareMessageText + '\n\n' : ''}Check out this expense: #EXP-${shareModalExp.id}`,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                organizationId: state.currentOrganization?.id,
                type: 'internal'
            };
            await db.collection('messages').doc(msgObj.id).set(msgObj);
            showToast.warn("Expense shared successfully!");
            setShareModalExp(null);
            setShareMessageText('');
        } catch (e) {
            showToast.warn("Failed to share.");
        } finally {
            setIsSharing(false);
        }
    };
    const handleCapture = async (targetLogId: string, source: CameraSource) => {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: true,
                resultType: CameraResultType.Base64,
                source: source
            });
            
            if (image.base64String && (window as any).handleAttachReceipt) {
                const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
                (window as any).handleAttachReceipt(targetLogId, 'expense', dataUrl);
                showToast.warn("Receipt captured and attached!");
            }
        } catch (e: any) {
            console.error("Camera Error:", e);
            // Don't alert on cancel
            if (!e.message?.includes('User cancelled')) {
                showToast.warn(`Error matching: ${e.message}`);
            }
        }
    };

    const reconcileMode = false; // Disabled since setReconcileMode was unused

    const duplicateGroups = React.useMemo(() => {
        if (!reconcileMode) return [];
        const groups: any[][] = [];
        const checked = new Set();
        
        allExpenses.forEach((e1, i) => {
            if (checked.has(e1.id) || !e1.amount) return;
            const matches = [e1];
            allExpenses.forEach((e2, j) => {
                if (i !== j && !checked.has(e2.id) && Number(e1.amount).toFixed(2) === Number(e2.amount).toFixed(2)) {
                    const t1 = new Date(e1.date).getTime();
                    const t2 = new Date(e2.date).getTime();
                    if (Math.abs(t1 - t2) <= 7 * 24 * 60 * 60 * 1000) {
                        matches.push(e2);
                    }
                }
            });
            if (matches.length > 1) {
                matches.forEach(m => checked.add(m.id));
                groups.push(matches);
            }
        });
        return groups;
    }, [allExpenses, reconcileMode]);

    const [sortBy, setSortBy] = useState('date_desc');
    const [searchTerm, setSearchTerm] = useState('');
    const [taxMode, setTaxMode] = useState(false);
    const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());

    const taxSummary = React.useMemo(() => {
        if (!taxMode) return [];
        const summary: Record<string, { total: number, deductible: number, count: number }> = {};
        allExpenses.forEach(exp => {
            const dateStr = exp.date || '';
            if (dateStr.startsWith(taxYear)) {
                const cat = exp.category || 'Other expenses';
                const amt = Number(exp.amount) || 0;
                let deductPct = 1.0;
                if (cat.includes('Meals')) deductPct = 0.5;
                if (!summary[cat]) summary[cat] = { total: 0, deductible: 0, count: 0 };
                summary[cat].total += amt;
                summary[cat].deductible += (amt * deductPct);
                summary[cat].count += 1;
            }
        });
        return Object.entries(summary).map(([category, data]) => ({ category, ...data })).sort((a,b) => b.deductible - a.deductible);
    }, [allExpenses, taxMode, taxYear]);

    const handleExportTaxCSV = () => {
        let csv = 'Tax Category,Total Amount,Deductible Amount,Transaction Count\n';
        taxSummary.forEach(row => {
            csv += `"${row.category}",${row.total.toFixed(2)},${row.deductible.toFixed(2)},${row.count}\n`;
        });
        const totalDeductible = taxSummary.reduce((sum, r) => sum + r.deductible, 0);
        csv += `\n"TOTAL DEDUCTIBLE EXPENDITURES",,${totalDeductible.toFixed(2)},`;
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Tax_Summary_${taxYear}.csv`;
        a.click();
    };

    const sortedExpenses = React.useMemo(() => {
        return [...allExpenses]
            .filter(exp => {
                if (!searchTerm) return true;
                const q = searchTerm.toLowerCase();
                const amt = (Number(exp.amount) || 0).toFixed(2);
                return (
                    (exp.vendor || '').toLowerCase().includes(q) ||
                    (exp.category || '').toLowerCase().includes(q) ||
                    (exp.description || '').toLowerCase().includes(q) ||
                    (exp.date || '').includes(q) ||
                    amt.includes(q)
                );
            })
            .sort((a, b) => {
            switch(sortBy) {
                case 'date_asc':
                    return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
                case 'name_asc':
                    return (a.vendor || '').localeCompare(b.vendor || '');
                case 'name_desc':
                    return (b.vendor || '').localeCompare(a.vendor || '');
                case 'amount_desc':
                    return (Number(b.amount) || 0) - (Number(a.amount) || 0);
                case 'amount_asc':
                    return (Number(a.amount) || 0) - (Number(b.amount) || 0);
                case 'date_desc':
                default:
                    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
            }
        });
    }, [allExpenses, sortBy, searchTerm]);

    return (
        <Card>
            <Modal isOpen={!!shareModalExp} onClose={() => setShareModalExp(null)} title={`Share Expense: ${shareModalExp?.vendor}`}>
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500">Send this expense reference to a staff member.</p>
                     <select 
                         aria-label="Select Share Recipient"
                         title="Select Share Recipient"
                         className="w-full border rounded-lg p-2 text-slate-900 dark:text-white dark:bg-slate-800 dark:border-slate-700 bg-white"
                         value={shareTargetId}
                         onChange={e => setShareTargetId(e.target.value)}
                     >
                         <option value="">Select Recipient...</option>
                         {state.users.filter((u: any) => 
                             u.organizationId === state.currentOrganization?.id && 
                             u.id !== state.currentUser?.id && 
                             u.role !== 'customer'
                         ).map((u: any) => (
                             <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                         ))}
                     </select>
                     <Textarea 
                         placeholder="Add an optional message..."
                         value={shareMessageText}
                         onChange={e => setShareMessageText(e.target.value)}
                     />
                     <div className="flex justify-end gap-2">
                         <Button variant="secondary" onClick={() => setShareModalExp(null)}>Cancel</Button>
                         <Button onClick={handleShareExpense} disabled={!shareTargetId || isSharing}>
                             {isSharing ? 'Sending...' : 'Send Message'}
                         </Button>
                     </div>
                 </div>
             </Modal>
            <div className="flex flex-col gap-4 mb-4">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search expenses by vendor, category, or amount..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    />
                </div>
                <div className="flex justify-between items-center flex-wrap gap-4">
                <h3 className="font-bold text-gray-800 dark:text-white">Accounts Payable & Expenses</h3>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        <label htmlFor="sort-expenses" className="font-medium text-slate-600 dark:text-slate-300">Sort by:</label>
                        <select 
                            id="sort-expenses"
                            aria-label="Sort Expenses"
                            className="border rounded-lg p-1.5 dark:bg-slate-800 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="date_desc">Newest First</option>
                            <option value="date_asc">Oldest First</option>
                            <option value="name_asc">Vendor (A-Z)</option>
                            <option value="name_desc">Vendor (Z-A)</option>
                            <option value="amount_desc">Amount (High to Low)</option>
                            <option value="amount_asc">Amount (Low to High)</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <Button variant={taxMode ? "primary" : "secondary"} onClick={() => setTaxMode(!taxMode)} className="w-auto text-xs flex items-center gap-2">
                            <Calculator size={14} /> {taxMode ? 'Exit Tax Prep' : 'Tax Prep Mode'}
                        </Button>
                        <Button onClick={() => { 
                            setNewExpense({date: new Date().toISOString().split('T')[0], category: 'Materials', description: '', amount: 0, vendor: '', paidBy: currentUser?.firstName || 'Admin', projectId: ''}); 
                            setIsExpenseModalOpen(true); 
                        }} className="w-auto text-xs">+ Add Expense</Button>
                    </div>
                </div>
                </div>
            </div>
            {reconcileMode && duplicateGroups.length === 0 && (
                <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-slate-800/50 rounded-xl mb-4 border border-dashed border-gray-300 dark:border-slate-700">
                    <p className="font-bold text-lg mb-2">No Duplicates Found!</p>
                    <p className="text-sm">We couldn't find any expenses with matching amounts within a 7-day window.</p>
                </div>
            )}
            
            {taxMode ? (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex flex-wrap justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                        <div>
                            <h4 className="font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2"><FileText size={18}/> Schedule C / 1120S Tax Preparation</h4>
                            <p className="text-xs text-indigo-700 dark:text-indigo-300">Expenditures mapped to IRS tax categories for the selected year.</p>
                        </div>
                        <div className="flex gap-3 items-center">
                            <select 
                                aria-label="Tax Year"
                                className="border rounded-lg p-1.5 font-bold dark:bg-slate-800 dark:border-slate-600"
                                value={taxYear}
                                onChange={(e) => setTaxYear(e.target.value)}
                            >
                                <option value="2026">2026</option>
                                <option value="2025">2025</option>
                                <option value="2024">2024</option>
                                <option value="2023">2023</option>
                            </select>
                            <Button variant="secondary" onClick={handleExportTaxCSV} className="text-xs flex items-center gap-1 bg-white dark:bg-slate-800"><Download size={14}/> Export CSV</Button>
                        </div>
                    </div>
                    
                    <Table headers={['Tax Category', 'Transaction Count', 'Total Spend', 'Deductible Amount']}>
                        {taxSummary.map(row => (
                            <tr key={row.category} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{row.category}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{row.count} Receipts</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">${row.total.toFixed(2)}</td>
                                <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">${row.deductible.toFixed(2)}</td>
                            </tr>
                        ))}
                    </Table>
                    
                    <div className="flex justify-end mt-4">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 text-right">
                            <div className="text-sm text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-bold">Estimated Total Deductions</div>
                            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                ${taxSummary.reduce((sum, r) => sum + r.deductible, 0).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (reconcileMode && duplicateGroups.length > 0) ? (
                <div className="space-y-6">
                    {duplicateGroups.map((group, gIdx) => (
                        <div key={gIdx} className="border-2 border-amber-200 dark:border-amber-900/40 rounded-xl overflow-hidden bg-amber-50/30 dark:bg-amber-900/10">
                            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 px-4 text-amber-800 dark:text-amber-300 font-bold text-xs flex justify-between items-center">
                                <span>Possible Duplicate Group {gIdx + 1} (Amount: ${(Number(group[0].amount) || 0).toFixed(2)})</span>
                                <span className="text-[10px] uppercase font-black tracking-wider bg-amber-200 dark:bg-amber-800/50 px-2 py-0.5 rounded-full">{group.length} Matches</span>
                            </div>
                            <Table headers={['Date', 'Vendor', 'Description', 'Amount', 'Receipt', 'Actions']}>
                                {group.map((exp: any) => (
                                    <tr key={exp.id} className="hover:bg-white dark:hover:bg-slate-800">
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{exp.date}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white"><span className="text-xs font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded mr-2">{exp.category}</span>{exp.vendor}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{exp.description}</td>
                                        <td className="px-6 py-4 font-bold text-red-600">-${(Number(exp.amount) || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center">
                                            {(() => {
                                                const possibleReceipt = exp.receiptData || exp.receiptUrl || exp.receipt;
                                                const possibleUrls = exp.receiptUrls && exp.receiptUrls.length > 0 ? exp.receiptUrls : (possibleReceipt ? [possibleReceipt] : []);
                                                if (possibleUrls.length > 0) {
                                                    return (
                                                        <button onClick={() => setViewingReceipt(possibleUrls)} className="text-blue-500 hover:text-blue-700" title="View Receipt">
                                                            <Paperclip size={18} />
                                                            {possibleUrls.length > 1 && <span className="ml-1 text-[10px] font-bold bg-blue-100 text-blue-800 px-1 rounded-full">{possibleUrls.length}</span>}
                                                        </button>
                                                    )
                                                }
                                                return <span className="text-xs text-slate-400">No Receipt</span>;
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 flex flex-wrap gap-2 items-center">
                                            <button onClick={() => handleDeleteExpense(exp.id, exp.type)} className="text-red-500 hover:text-red-700 p-1 flex items-center gap-1 text-xs font-bold" title="Delete Duplicate"><Trash2 size={14}/> Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </Table>
                        </div>
                    ))}
                </div>
            ) : (
                <Table headers={['Date', 'Vendor', 'Category', 'Description', 'Amount', 'Receipt', 'Actions']}>
                    {sortedExpenses.map((exp: any) => (
                        <tr key={exp.id} title={`Keys: ${Object.keys(exp).join(', ')}`}>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{exp.date}</td>
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{exp.vendor}</td>
                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{exp.category}</td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{exp.description}</td>
                            <td className="px-6 py-4 font-bold text-red-600">-${(Number(exp.amount) || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 text-center group">
                                <div className="flex items-center justify-center gap-2">
                                    {(() => {
                                        const possibleReceipt = exp.receiptData || exp.receiptUrl || exp.receipt || exp.image || exp.imageUrl || exp.photo || exp.photoUrl || exp.attachment || exp.fileUrl;
                                        const possibleUrls = exp.receiptUrls && exp.receiptUrls.length > 0 ? exp.receiptUrls : (possibleReceipt ? [possibleReceipt] : []);
                                        
                                        if (possibleUrls.length > 0) {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setViewingReceipt(possibleUrls)} className="text-blue-500 hover:text-blue-700" title="View Receipt">
                                                        <Paperclip size={18} />
                                                        {possibleUrls.length > 1 && <span className="ml-1 text-[10px] font-bold bg-blue-100 text-blue-800 px-1 rounded-full">{possibleUrls.length}</span>}
                                                    </button>
                                                    <button onClick={() => handleDeleteReceipt(exp.id, exp.type)} className="text-red-500 hover:text-red-700" title="Delete Receipt">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div className="flex gap-3">
                                                    <button 
                                                        onClick={() => handleCapture(exp.id, CameraSource.Camera)}
                                                        className="text-slate-400 hover:text-primary-500 transition-colors flex flex-col items-center"
                                                        title="Take Photo"
                                                    >
                                                        <CameraIcon size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if (Capacitor.isNativePlatform()) {
                                                                handleCapture(exp.id, CameraSource.Photos);
                                                            } else {
                                                                document.getElementById(`file-input-${exp.id}`)?.click();
                                                            }
                                                        }}
                                                        className="text-slate-400 hover:text-primary-500 transition-colors flex flex-col items-center"
                                                        title="Upload Image"
                                                    >
                                                        <ImageIcon size={18} />
                                                    </button>
                                                    <input 
                                                        id={`file-input-${exp.id}`}
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="hidden" 
                                                        aria-label="Upload Receipt"
                                                        title="Upload Receipt" 
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file && (window as any).handleAttachReceipt) {
                                                                (window as any).handleAttachReceipt(exp.id, exp.type, file);
                                                                showToast.warn("Receipt uploaded and attached!");
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                            </td>
                            <td className="px-6 py-4 flex flex-wrap gap-2 items-center">
                                <button onClick={() => handleEditExpense(exp)} className="text-blue-500 hover:text-blue-700 p-1" title="Edit Expense"><Edit size={16}/></button>
                                <button aria-label="Copy Reference" title="Copy Reference" onClick={(e) => { e.stopPropagation(); handleCopyRef(exp.id); }} className="p-1 text-slate-400 hover:text-primary-600"><Copy size={16}/></button>
                                <button aria-label="Share Expense" title="Share Expense" onClick={(e) => { e.stopPropagation(); setShareModalExp(exp); }} className="p-1 text-slate-400 hover:text-primary-600"><Share2 size={16}/></button>
                                <button onClick={() => handleDeleteExpense(exp.id, exp.type)} className="text-red-500 hover:text-red-700 p-1" title="Delete Expense"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                </Table>
            )}
        </Card>
    );
};

export default ExpensesTab;
