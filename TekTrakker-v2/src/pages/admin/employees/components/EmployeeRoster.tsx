
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { User } from 'types';
import { Trash2 } from 'lucide-react';

interface EmployeeRosterProps {
    employees: User[];
    handleEdit: (user: User) => void;
    handleArchive: (id: string) => void;
    handleDelete: (id: string) => void;
}

const EmployeeRoster: React.FC<EmployeeRosterProps> = ({
    employees,
    handleEdit,
    handleArchive,
    handleDelete
}) => {
    const isOnline = (emp: User) => {
        const now = new Date();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        
        const lastLogin = emp.lastLoginAt ? new Date(emp.lastLoginAt).getTime() : 0;
        const lastLoc = emp.lastLocationUpdate ? new Date(emp.lastLocationUpdate).getTime() : 0;
        
        const isRecentLogin = (now.getTime() - lastLogin) < TWENTY_FOUR_HOURS;
        const isRecentLoc = (now.getTime() - lastLoc) < FOUR_HOURS;

        return isRecentLogin || isRecentLoc;
    };

    return (
        <Card>
            <Table headers={['Name / ID', 'Role', 'Contact', 'Status', 'Actions']}>
                {employees.map(emp => {
                    const online = isOnline(emp);
                    return (
                        <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-6 py-4 text-gray-900 dark:text-white">
                                <div className="font-medium flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                                    {emp.firstName} {emp.lastName}
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono pl-4">{emp.id}</div>
                            </td>
                            <td className="px-6 py-4 capitalize text-gray-600 dark:text-gray-300">{emp.role?.replace('_', ' ')}</td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">
                                <div>{emp.email}</div>
                                <div>{emp.phone}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {emp.status || 'Active'}
                                </span>
                                <div className="text-[10px] text-gray-400 mt-1">
                                    {online ? 'Online recently' : 'Offline'}
                                </div>
                            </td>
                            <td className="px-6 py-4 flex gap-3">
                                <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:underline text-sm font-bold">Edit</button>
                                <button onClick={() => handleArchive(emp.id)} className="text-orange-700 dark:text-orange-400 hover:underline text-sm font-bold">Archive</button>
                                <button onClick={() => handleDelete(emp.id)} className="text-red-700 dark:text-red-400 hover:underline text-sm font-bold"><Trash2 size={14}/></button>
                            </td>
                        </tr>
                    );
                })}
                {employees.length === 0 && (
                    <tr><td colSpan={5} className="p-4 md:p-8 text-center text-gray-500">No employees found.</td></tr>
                )}
            </Table>
        </Card>
    );
};

export default EmployeeRoster;
