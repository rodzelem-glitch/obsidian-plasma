
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { User } from 'types';
import { Trash2, Clock, Mail, Phone, Edit } from 'lucide-react';

interface EmployeeRosterProps {
    employees: User[];
    handleEdit: (user: User) => void;
    handleArchive: (id: string) => void;
    handleDelete: (id: string) => void;
    onViewTechs?: (user: User) => void;
}

const EmployeeRoster: React.FC<EmployeeRosterProps> = ({
    employees,
    handleEdit,
    handleArchive,
    handleDelete,
    onViewTechs
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

    const formatLastLogin = (lastLoginAt?: string) => {
        if (!lastLoginAt) return <span className="text-slate-400 italic text-xs">Never</span>;
        try {
            const d = new Date(lastLoginAt);
            if (isNaN(d.getTime())) return <span className="text-slate-400 italic text-xs">Never</span>;

            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            let relative = '';
            if (diffMins < 2) relative = 'Just now';
            else if (diffMins < 60) relative = `${diffMins}m ago`;
            else if (diffHours < 24) relative = `${diffHours}h ago`;
            else if (diffDays === 1) relative = 'Yesterday';
            else if (diffDays < 30) relative = `${diffDays}d ago`;
            else relative = d.toLocaleDateString();

            return (
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                        {relative}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            );
        } catch {
            return <span className="text-slate-400 italic text-xs">Never</span>;
        }
    };

    return (
        <Card>
            {/* Mobile Cards View (App / Mobile View Only) */}
            <div className="md:hidden space-y-3 p-1">
                {employees.map(emp => {
                    const online = isOnline(emp);
                    return (
                        <div key={`emp-card-${emp.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3">
                            {/* Header: Name, ID, Online dot, Role, Status */}
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${online ? 'bg-green-500 ring-4 ring-green-100 dark:ring-green-950/40' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                        <span className="font-bold text-base text-slate-900 dark:text-white">
                                            {emp.firstName} {emp.lastName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {emp.id}
                                        </span>
                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded font-semibold capitalize">
                                            {emp.role?.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${emp.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>
                                        {emp.status || 'Active'}
                                    </span>
                                    <span className="text-[9px] text-slate-400 mt-1">
                                        {online ? 'Online recently' : 'Offline'}
                                    </span>
                                </div>
                            </div>

                            {/* Contact Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                {emp.email && (
                                    <div className="flex items-center gap-1.5 truncate">
                                        <Mail size={13} className="text-slate-400 shrink-0" />
                                        <a href={`mailto:${emp.email}`} className="truncate hover:text-blue-600">
                                            {emp.email}
                                        </a>
                                    </div>
                                )}
                                {emp.phone && (
                                    <div className="flex items-center gap-1.5">
                                        <Phone size={13} className="text-slate-400 shrink-0" />
                                        <a href={`tel:${emp.phone}`} className="hover:text-blue-600 font-mono">
                                            {emp.phone}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Last Login Info & Action Bar */}
                            <div className="flex items-center justify-between pt-1 text-xs">
                                <div>
                                    {formatLastLogin(emp.lastLoginAt)}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button 
                                        onClick={() => handleEdit(emp)} 
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 rounded-lg text-xs font-bold hover:bg-blue-100"
                                    >
                                        <Edit size={12} />
                                        Edit
                                    </button>
                                    {emp.role === 'Subcontractor' && onViewTechs && (
                                        <button 
                                            onClick={() => onViewTechs(emp)} 
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 rounded-lg text-xs font-bold hover:bg-indigo-100"
                                        >
                                            Crew
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleArchive(emp.id)} 
                                        className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-bold hover:bg-orange-50"
                                    >
                                        Archive
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(emp.id)} 
                                        className="p-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-100"
                                        title="Delete Employee"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {employees.length === 0 && (
                    <div className="p-8 text-center text-gray-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        No employees found.
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
            <Table headers={['Name / ID', 'Role', 'Contact', 'Status', 'Last Login', 'Actions']}>
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
                            <td className="px-6 py-4 text-sm">
                                {formatLastLogin(emp.lastLoginAt)}
                            </td>
                            <td className="px-6 py-4 flex gap-3 items-center">
                                <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:underline text-sm font-bold">Edit</button>
                                {emp.role === 'Subcontractor' && onViewTechs && (
                                    <button onClick={() => onViewTechs(emp)} className="text-indigo-600 hover:underline text-sm font-bold">Crew</button>
                                )}
                                <button onClick={() => handleArchive(emp.id)} className="text-orange-700 dark:text-orange-400 hover:underline text-sm font-bold">Archive</button>
                                <button onClick={() => handleDelete(emp.id)} className="text-red-700 dark:text-red-400 hover:underline text-sm font-bold"><Trash2 size={14}/></button>
                            </td>
                        </tr>
                    );
                })}
                {employees.length === 0 && (
                    <tr><td colSpan={6} className="p-4 md:p-8 text-center text-gray-500">No employees found.</td></tr>
                )}
            </Table>
            </div>
        </Card>
    );
};

export default EmployeeRoster;
