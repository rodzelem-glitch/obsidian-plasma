
import React from 'react';
import Card from '../../../../../components/ui/Card';
import Table from '../../../../../components/ui/Table';
import Button from '../../../../../components/ui/Button';
import type { Subcontractor } from '../../../../../types';

interface SubsTabProps {
    subcontractors: Subcontractor[];
    assignedSubcontractorIds?: string[];
    onSubAdd: () => void;
    onSubEdit: (sub: Subcontractor) => void;
}

const SubsTab: React.FC<SubsTabProps> = ({ subcontractors, assignedSubcontractorIds = [], onSubAdd, onSubEdit }) => {
    return (
        <Card>
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Subcontractors</h3>
                <Button onClick={onSubAdd} className="text-xs w-auto">+ Add Sub</Button>
             </div>
             <Table headers={['Company', 'Trade', 'Contact', 'Status', 'Action']}>
                {subcontractors.map(sub => (
                    <tr key={sub.id}>
                        <td className="px-6 py-4 font-bold flex items-center gap-2">
                            {sub.companyName}
                            {assignedSubcontractorIds.includes(sub.id) && (
                                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                    Assigned
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4">{sub.trade}</td>
                        <td className="px-6 py-4 text-sm">{sub.contactName}</td>
                        <td className="px-6 py-4 text-sm">{sub.status}</td>
                        <td className="px-6 py-4">
                            <button onClick={() => onSubEdit(sub)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default SubsTab;
