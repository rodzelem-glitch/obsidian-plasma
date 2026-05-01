import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import Button from 'components/ui/Button';
import type { User, Subcontractor, OrganizationTeam } from 'types';

export interface WBSNodeForm {
    type: 'Phase' | 'Deliverable' | 'WorkPackage';
    id?: string;
    parentId?: string; // ID of the Project, Phase, or Deliverable it belongs to
    name: string;
    description: string;
    status: string;
    startDate?: string;
    endDate?: string;
    dueDate?: string;
    assignedTeam?: string;
}

interface WBSNodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (node: WBSNodeForm) => void;
    nodeForm: WBSNodeForm;
    setNodeForm: (form: WBSNodeForm) => void;
    employees: User[];
    subcontractors: Subcontractor[];
    teams: OrganizationTeam[];
}

const WBSNodeModal: React.FC<WBSNodeModalProps> = ({ isOpen, onClose, onSave, nodeForm, setNodeForm, employees, subcontractors, teams }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${nodeForm.id ? 'Edit' : 'Add'} ${nodeForm.type}`}>
            <div className="space-y-4">
                <Input 
                    label="Name" 
                    value={nodeForm.name} 
                    onChange={e => setNodeForm({...nodeForm, name: e.target.value})} 
                    required 
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select 
                        label="Status" 
                        value={nodeForm.status} 
                        onChange={e => setNodeForm({...nodeForm, status: e.target.value})}
                    >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                    </Select>
                    
                    {nodeForm.type === 'Deliverable' && (
                        <Input 
                            label="Due Date" 
                            type="date" 
                            value={nodeForm.dueDate || ''} 
                            onChange={e => setNodeForm({...nodeForm, dueDate: e.target.value})} 
                        />
                    )}
                    {nodeForm.type === 'Phase' && (
                        <>
                            <Input 
                                label="Start Date" 
                                type="date" 
                                value={nodeForm.startDate || ''} 
                                onChange={e => setNodeForm({...nodeForm, startDate: e.target.value})} 
                            />
                            <Input 
                                label="End Date" 
                                type="date" 
                                value={nodeForm.endDate || ''} 
                                onChange={e => setNodeForm({...nodeForm, endDate: e.target.value})} 
                            />
                        </>
                    )}
                    {nodeForm.type === 'WorkPackage' && (
                        <Select 
                            label="Assigned Team/Contractor" 
                            value={nodeForm.assignedTeam || ''} 
                            onChange={e => setNodeForm({...nodeForm, assignedTeam: e.target.value})} 
                        >
                            <option value="">Unassigned</option>
                            {teams && teams.length > 0 && (
                                <optgroup label="Teams">
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </optgroup>
                            )}
                            {employees && employees.length > 0 && (
                                <optgroup label="Employees">
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.firstName} {emp.lastName}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {subcontractors && subcontractors.length > 0 && (
                                <optgroup label="Subcontractors">
                                    {subcontractors.map(sub => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.companyName}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </Select>
                    )}
                </div>

                <Textarea 
                    label="Description" 
                    value={nodeForm.description} 
                    onChange={e => setNodeForm({...nodeForm, description: e.target.value})} 
                />

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onSave(nodeForm)}>Save {nodeForm.type}</Button>
                </div>
            </div>
        </Modal>
    );
};

export default WBSNodeModal;
