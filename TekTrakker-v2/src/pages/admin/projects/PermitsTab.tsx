import React from 'react';
import type { Permit } from 'types';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';

interface PermitsTabProps {
    permits: Permit[];
    onAddPermit: () => void;
    onEditPermit: (permit: Permit) => void;
}

const PermitsTab: React.FC<PermitsTabProps> = ({ permits, onAddPermit, onEditPermit }) => {
    return (
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg">
            <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Permits</h3>
                <Button onClick={onAddPermit} className="text-xs w-auto">+ Add Permit</Button>
            </div>
            <Table headers={['Permit #', 'Type', 'Status', 'Dates', 'Action']}>
                {(permits || []).map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/80">
                        <td className="px-6 py-4 font-bold">{p.number}</td>
                        <td className="px-6 py-4">{p.type}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs ${p.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100'}`}>{p.status}</span></td>
                        <td className="px-6 py-4 text-xs text-gray-500">Issued: {p.issueDate}</td>
                        <td className="px-6 py-4"><button onClick={() => onEditPermit(p)} className="text-blue-600 hover:underline text-xs">Edit</button></td>
                    </tr>
                ))}
                 {permits.length === 0 && <tr><td colSpan={5} className="p-4 md:p-8 text-center text-slate-500">No permits found.</td></tr>}
            </Table>
        </div>
    );
};

export default PermitsTab;
