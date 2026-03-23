
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { CheckCircle, XCircle, FileText, DollarSign, Edit, Trash2 } from 'lucide-react';
import type { User } from 'types';

interface RosterTabProps {
    salesReps: User[];
    onOpenContract: (rep: User) => void;
    onOpenTaxView: (rep: User) => void;
    onEditRep: (rep: User) => void;
    onDeleteRep: (userId: string) => void;
}

const RosterTab: React.FC<RosterTabProps> = ({ salesReps, onOpenContract, onOpenTaxView, onEditRep, onDeleteRep }) => {
    return (
        <Card>
            <Table headers={['Name', 'Email', 'Contract Status', 'Actions']}>
                {salesReps.map(rep => (
                    <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-6 py-4 font-bold">{rep.firstName} {rep.lastName}</td>
                        <td className="px-6 py-4 text-slate-500">{rep.email}</td>
                        <td className="px-6 py-4">
                            {rep.salesContractSigned ? (
                                <span className="flex items-center gap-1 text-green-600 font-bold text-xs uppercase">
                                    <CheckCircle size={14} /> Signed
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-500 font-bold text-xs uppercase">
                                    <XCircle size={14} /> Pending
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4 flex gap-3">
                            <button onClick={() => onOpenContract(rep)} className="text-blue-600 hover:underline text-xs font-bold flex items-center gap-1">
                                <FileText size={14} /> Contract
                            </button>
                            <button onClick={() => onOpenTaxView(rep)} className="text-slate-600 hover:underline text-xs font-bold flex items-center gap-1">
                                <DollarSign size={14} /> Tax Forms
                            </button>
                            <button onClick={() => onEditRep(rep)} className="text-purple-600 hover:underline text-xs font-bold flex items-center gap-1">
                                <Edit size={14} /> Edit
                            </button>
                            <button onClick={() => onDeleteRep(rep.id)} className="text-red-600 hover:underline text-xs font-bold flex items-center gap-1">
                                <Trash2 size={14} /> Delete
                            </button>
                        </td>
                    </tr>
                ))}
                {salesReps.length === 0 && <tr><td colSpan={4} className="p-4 md:p-8 text-center text-slate-500">No sales representatives found.</td></tr>}
            </Table>
        </Card>
    );
};

export default RosterTab;
