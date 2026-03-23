import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { Edit, Trash2 } from 'lucide-react';
import type { Job, Expense } from 'types';

type ProjectFinancials = {
    invoices: Job[];
    expenses: Expense[];
    totalExpenses: number;
    totalBilled: number;
    totalCollected: number;
};

interface FinancialsTabProps {
    financials: ProjectFinancials;
    onCreateInvoice: () => void;
    onManageInvoice: (jobId: string) => void;
    onAddExpense: () => void;
    onEditExpense: (expense: Expense) => void;
    onDeleteExpense: (expenseId: string) => void;
}

const FinancialsTab: React.FC<FinancialsTabProps> = ({
    financials,
    onCreateInvoice,
    onManageInvoice,
    onAddExpense,
    onEditExpense,
    onDeleteExpense,
}) => {
    return (
        <div className="space-y-8">
            {/* Invoices Section */}
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Project Invoices (Accounts Receivable)</h3>
                    <Button onClick={onCreateInvoice} className="text-xs w-auto bg-emerald-600 hover:bg-emerald-700">+ Create Invoice</Button>
                </div>
                <Table headers={['Invoice ID', 'Date', 'Status', 'Amount', 'Actions']}>
                    {financials.invoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="px-6 py-4 font-mono text-xs">{inv.invoice?.id}</td>
                            <td className="px-6 py-4 text-sm">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${inv.invoice?.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.invoice?.status}</span>
                            </td>
                            <td className="px-6 py-4 font-bold">${(inv.invoice?.totalAmount || inv.invoice?.amount || 0).toLocaleString()}</td>
                            <td className="px-6 py-4">
                                <button onClick={() => onManageInvoice(inv.id)} className="text-blue-600 hover:underline text-xs font-bold">Manage</button>
                            </td>
                        </tr>
                    ))}
                    {financials.invoices.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No invoices created for this project.</td></tr>}
                </Table>
            </Card>

            {/* Expenses Section */}
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Project Expenses (Accounts Payable)</h3>
                    <Button onClick={onAddExpense} className="text-xs w-auto">+ Log Expense</Button>
                </div>
                <Table headers={['Date', 'Vendor', 'Category', 'Description', 'Amount', 'Actions']}>
                    {financials.expenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="px-6 py-4 text-sm">{exp.date ? new Date(exp.date).toLocaleDateString() : '-'}</td>
                            <td className="px-6 py-4 font-medium">{exp.vendor}</td>
                            <td className="px-6 py-4 text-xs">{exp.category}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{exp.description}</td>
                            <td className="px-6 py-4 font-bold text-red-600">-${exp.amount.toLocaleString()}</td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => onEditExpense(exp)} className="text-blue-500 hover:text-blue-700"><Edit size={14}/></button>
                                <button onClick={() => onDeleteExpense(exp.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                            </td>
                        </tr>
                    ))}
                    {financials.expenses.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No expenses recorded.</td></tr>}
                </Table>
            </Card>
        </div>
    );
};

export default FinancialsTab;
