import React from 'react';
import type { Subcontractor } from 'types';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';

interface SubcontractorsTabProps {
    subcontractors: Subcontractor[];
    onAddSub: () => void;
    onEditSub: (sub: Subcontractor) => void;
}

const SubcontractorsTab: React.FC<SubcontractorsTabProps> = ({ subcontractors, onAddSub, onEditSub }) => {
    return (
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg">
            <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Subcontractors</h3>
                <Button onClick={onAddSub} className="text-xs w-auto">+ Add Sub</Button>
            </div>
            <Table headers={['Company', 'Trade', 'Contact', 'Status', 'Action']}>
                {subcontractors.map(sub => (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80">
                        <td className="px-6 py-4 font-bold">{sub.companyName}</td>
                        <td className="px-6 py-4">{sub.trade}</td>
                        <td className="px-6 py-4 text-sm">{sub.contactName}</td>
                        <td className="px-6 py-4 text-sm">{sub.status}</td>
                        <td className="px-6 py-4"><button onClick={() => onEditSub(sub)} className="text-blue-600 hover:underline text-xs">Edit</button></td>
                    </tr>
                ))}
                {subcontractors.length === 0 && <tr><td colSpan={5} className="p-4 md:p-8 text-center text-slate-500">No subcontractors found.</td></tr>}
            </Table>
        </div>
    );
};

export default SubcontractorsTab;
