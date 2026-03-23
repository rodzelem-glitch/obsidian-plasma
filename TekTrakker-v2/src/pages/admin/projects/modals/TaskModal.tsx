import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import type { ProjectTask, User } from 'types';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Partial<ProjectTask>) => void;
    taskForm: Partial<ProjectTask>;
    setTaskForm: (form: Partial<ProjectTask>) => void;
    employees: User[];
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, taskForm, setTaskForm, employees }) => {

    const handleSave = () => {
        onSave(taskForm);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Task">
            <div className="space-y-4">
                <Input label="Description" value={taskForm.description || ''} onChange={e => setTaskForm({...taskForm, description: e.target.value})} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Status" value={taskForm.status} onChange={e => setTaskForm({...taskForm, status: e.target.value as any})}>
                        <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Completed">Completed</option>
                    </Select>
                    <Input label="Due Date" type="date" value={taskForm.dueDate || ''} onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} />
                </div>
                <Select label="Assigned To" value={taskForm.assignedTo || ''} onChange={e => setTaskForm({...taskForm, assignedTo: e.target.value})}>
                    <option value="">-- Unassigned --</option>
                    {employees.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </Select>
                <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={taskForm.isBenchmark} onChange={e => setTaskForm({...taskForm, isBenchmark: e.target.checked})} />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Is Milestone/Benchmark?</span>
                </label>
                <div className="flex justify-end gap-2 pt-4">
                    <Button onClick={handleSave}>Save Task</Button>
                </div>
            </div>
        </Modal>
    );
}

export default TaskModal;