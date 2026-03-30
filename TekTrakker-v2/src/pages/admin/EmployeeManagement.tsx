
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import { db } from 'lib/firebase';
import EmployeeProfileModal from 'components/modals/EmployeeProfileModal';
import type { User } from 'types';
import { GitMerge, Plus } from 'lucide-react';
import EmployeeRoster from './employees/components/EmployeeRoster';
import MergeModal from './employees/components/MergeModal';
import { globalConfirm } from "lib/globalConfirm";

// All roles that should appear in the workforce roster
const WORKFORCE_ROLES = ['employee', 'both', 'supervisor', 'Technician', 'Subcontractor', 'admin'];

const EmployeeManagement: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentEmployee, setCurrentEmployee] = useState<Partial<User>>({});
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    
    const employees = useMemo(() => {
        const currentUser = state.currentUser;
        return state.users.filter(u => 
            u.organizationId === state.currentOrganization?.id && 
            WORKFORCE_ROLES.includes(u.role) &&
            (currentUser?.role !== 'supervisor' || u.reportsTo === currentUser?.id || u.id === currentUser?.id)
        );
    }, [state.users, state.currentOrganization, state.currentUser]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(u => 
            ((u.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
             (u.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [employees, searchTerm]);

    const handleEdit = (user: User) => {
        setCurrentEmployee(user);
        setIsProfileModalOpen(true);
    };

    const handleAdd = () => {
        setCurrentEmployee({});
        setIsProfileModalOpen(true);
    };

    const handleArchive = async (id: string) => {
        if(await globalConfirm('Archive User?')) {
            await db.collection('users').doc(id).update({ status: 'archived' });
        }
    };
    
    const handleDelete = async (id: string) => {
        if(await globalConfirm('PERMANENTLY DELETE User?')) {
            await db.collection('users').doc(id).delete();
        }
    };

    return (
        <div className="space-y-6">
            {isProfileModalOpen && (
                <EmployeeProfileModal 
                    isOpen={true} 
                    onClose={() => setIsProfileModalOpen(false)} 
                    employee={currentEmployee} 
                />
            )}
            <MergeModal 
                isOpen={isMergeModalOpen} 
                onClose={() => setIsMergeModalOpen(false)} 
                employees={employees} 
            />

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Employee Management</h2>
                    <p className="text-gray-600 dark:text-gray-400">Manage technicians and staff.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setIsMergeModalOpen(true)} variant="secondary" className="w-auto flex items-center gap-2">
                        <GitMerge size={18}/> Merge Duplicates
                    </Button>
                    <Button onClick={handleAdd} className="w-auto flex items-center gap-2">
                        <Plus size={18}/> Add Employee
                    </Button>
                </div>
            </header>

            <Input label="" placeholder="Search Employees..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

            <EmployeeRoster 
                employees={filteredEmployees}
                handleEdit={handleEdit}
                handleArchive={handleArchive}
                handleDelete={handleDelete}
            />
        </div>
    );
};

export default EmployeeManagement;
