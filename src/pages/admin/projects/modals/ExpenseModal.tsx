import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import type { Expense } from 'types';

interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: Partial<Expense>) => void;
    expenseForm: Partial<Expense>;
    setExpenseForm: (form: Partial<Expense>) => void;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, onSave, expenseForm, setExpenseForm }) => {

    const handleSave = () => {
        onSave(expenseForm);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={expenseForm.id ? "Edit Expense" : "Log Project Expense"}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Date" type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
                    <Input label="Amount ($)" type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: parseFloat(e.target.value)})} />
                </div>
                <Input label="Vendor" value={expenseForm.vendor || ''} onChange={e => setExpenseForm({...expenseForm, vendor: e.target.value})} />
                <Select label="Category" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                     <option value="Materials">Materials</option><option value="Labor">Subcontractor Labor</option><option value="Permits">Permits/Fees</option><option value="Other">Other</option>
                </Select>
                <Input label="Description" value={expenseForm.description || ''} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} />
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Expense</Button>
                </div>
            </div>
        </Modal>
    );
}

export default ExpenseModal;