
import React from 'react';
import Select from 'components/ui/Select';
import { User } from 'types';

interface EmployeeSelectorProps {
    employees: User[];
    selectedUserId: string;
    onSelect: (id: string) => void;
}

const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({ employees, selectedUserId, onSelect }) => {
    return (
        <div className="mb-6 max-w-md">
            <Select label="Select Employee" value={selectedUserId} onChange={e => onSelect(e.target.value)}>
                <option value="">-- Choose Technician --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </Select>
        </div>
    );
};

export default EmployeeSelector;
