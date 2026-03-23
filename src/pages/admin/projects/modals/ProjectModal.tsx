import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import Button from 'components/ui/Button';
import type { Project, Customer, User } from 'types';

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (project: Partial<Project>) => void;
    projectForm: Partial<Project>;
    setProjectForm: (form: Partial<Project>) => void;
    customers: Customer[];
    employees: User[];
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSave, projectForm, setProjectForm, customers, employees }) => {
    
    const handleSave = () => {
        onSave(projectForm);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={projectForm.id ? "Edit Project" : "New Project"}>
            <div className="space-y-4">
                <Input label="Project Name" value={projectForm.name || ''} onChange={e => setProjectForm({...projectForm, name: e.target.value})} required />
                <Select label="Customer" value={projectForm.customerId || ''} onChange={e => setProjectForm({...projectForm, customerId: e.target.value})}>
                    <option value="">-- Select Customer --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Status" value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value as any})}>
                        <option value="Planning">Planning</option><option value="In Progress">In Progress</option><option value="Completed">Completed</option>
                    </Select>
                    <Input label="Budget" type="number" value={projectForm.budget || 0} onChange={e => setProjectForm({...projectForm, budget: Number(e.target.value)})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Start Date" type="date" value={projectForm.startDate?.split('T')[0]} onChange={e => setProjectForm({...projectForm, startDate: e.target.value})} />
                    <Input label="End Date" type="date" value={projectForm.endDate} onChange={e => setProjectForm({...projectForm, endDate: e.target.value})} />
                </div>
                <Select label="Project Lead (Manager)" value={projectForm.managerId || ''} onChange={e => setProjectForm({...projectForm, managerId: e.target.value})}>
                    <option value="">-- Select Lead --</option>
                    {employees.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </Select>
                <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Team Members</label>
                     <div className="max-h-32 overflow-y-auto border rounded p-2 bg-slate-50 dark:bg-slate-800">
                         {employees.map(u => (
                             <label key={u.id} className="flex items-center gap-2 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                                 <input 
                                    type="checkbox" 
                                    checked={projectForm.teamIds?.includes(u.id)} 
                                    onChange={(e) => {
                                        const current = projectForm.teamIds || [];
                                        setProjectForm({
                                            ...projectForm,
                                            teamIds: e.target.checked 
                                                ? [...current, u.id]
                                                : current.filter(id => id !== u.id)
                                        });
                                    }}
                                    className="rounded"
                                 />
                                 <span className="text-sm text-slate-900 dark:text-white">{u.firstName} {u.lastName} <span className="text-xs text-slate-500">({u.role})</span></span>
                             </label>
                         ))}
                     </div>
                </div>
                <Textarea label="Description" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} />
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Project</Button>
                </div>
            </div>
        </Modal>
    );
}

export default ProjectModal;
