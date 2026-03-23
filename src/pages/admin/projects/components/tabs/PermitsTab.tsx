
import React from 'react';
import Card from '../../../../../components/ui/Card';
import Table from '../../../../../components/ui/Table';
import Button from '../../../../../components/ui/Button';
import type { Permit } from '../../../../../types';

interface PermitsTabProps {
    permits: Permit[];
    onPermitAdd: () => void;
    onPermitEdit: (permit: Permit) => void;
}

const PermitsTab: React.FC<PermitsTabProps> = ({ permits, onPermitAdd, onPermitEdit }) => {
    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Permits</h3>
                <Button onClick={onPermitAdd} className="text-xs w-auto">+ Add Permit</Button>
            </div>
            <Table headers={['Permit #', 'Type', 'Status', 'Dates', 'Action']}>
                {(permits || []).map((p, idx) => (
                    <tr key={idx}>
                        <td className="px-6 py-4 font-bold">{p.number}</td>
                        <td className="px-6 py-4">{p.type}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs ${p.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100'}`}>{p.status}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">Issued: {p.issueDate}</td>
                        <td className="px-6 py-4">
                            <button onClick={() => onPermitEdit(p)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default PermitsTab;
