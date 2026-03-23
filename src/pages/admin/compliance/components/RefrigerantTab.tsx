
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { Edit } from 'lucide-react';
import { RefrigerantCylinder, User } from 'types';

interface RefrigerantTabProps {
    cylinders: RefrigerantCylinder[];
    employees: User[];
    setIsAddCylinderOpen: (val: boolean) => void;
    setNewCylinder: (val: Partial<RefrigerantCylinder>) => void;
}

const RefrigerantTab: React.FC<RefrigerantTabProps> = ({
    cylinders,
    employees,
    setIsAddCylinderOpen,
    setNewCylinder
}) => {
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">Cylinder Inventory</h3>
                    <Button onClick={() => {
                        setNewCylinder({ type: 'R410A', status: 'Full', totalWeight: 25, remainingWeight: 25 });
                        setIsAddCylinderOpen(true);
                    }} className="w-auto text-xs">+ Add Tank</Button>
                </div>
                <Table headers={['Tag #', 'Type', 'Status', 'Weight', 'Assigned To', 'Actions']}>
                    {cylinders.map((c: any) => {
                        const assignedTech = employees.find(e => e.id === c.assignedTechId);
                        return (
                        <tr key={c.id}>
                            <td className="px-6 py-4 font-mono text-sm">{c.tag}</td>
                            <td className="px-6 py-4 font-bold">{c.type}</td>
                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${c.status === 'Empty' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{c.status}</span></td>
                            <td className="px-6 py-4 text-sm">{c.remainingWeight} / {c.totalWeight}</td>
                            <td className="px-6 py-4 text-sm">{assignedTech ? `${assignedTech.firstName} ${assignedTech.lastName}` : 'Unassigned'}</td>
                            <td className="px-6 py-4 flex gap-2"><button onClick={() => { setNewCylinder(c); setIsAddCylinderOpen(true); }} className="text-blue-500"><Edit size={16}/></button></td>
                        </tr>
                        );
                    })}
                </Table>
            </Card>
        </div>
    );
};

export default RefrigerantTab;
