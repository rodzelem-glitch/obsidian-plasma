import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import type { Sprint } from 'types';

interface SprintModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (sprint: Partial<Sprint>) => void;
    sprintForm: Partial<Sprint>;
    setSprintForm: (form: Partial<Sprint>) => void;
}

const SprintModal: React.FC<SprintModalProps> = ({ isOpen, onClose, onSave, sprintForm, setSprintForm }) => {
    const handleSave = () => {
        if (!sprintForm.name || !sprintForm.startDate || !sprintForm.endDate) return;
        onSave(sprintForm);
    };

    // Calculate sprint duration
    const duration = sprintForm.startDate && sprintForm.endDate
        ? Math.ceil((new Date(sprintForm.endDate).getTime() - new Date(sprintForm.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={sprintForm.id ? 'Edit Sprint' : 'Create Sprint'}>
            <div className="space-y-4">
                <Input 
                    label="Sprint Name" 
                    value={sprintForm.name || ''} 
                    onChange={e => setSprintForm({...sprintForm, name: e.target.value})} 
                    placeholder="Sprint 1, Week of 4/28, etc." 
                />

                <Input 
                    label="Sprint Goal (what are we trying to accomplish?)" 
                    value={sprintForm.goal || ''} 
                    onChange={e => setSprintForm({...sprintForm, goal: e.target.value})} 
                    placeholder="Complete Building A rough-in and pass inspection" 
                />

                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Start Date" 
                        type="date" 
                        value={sprintForm.startDate || ''} 
                        onChange={e => setSprintForm({...sprintForm, startDate: e.target.value})} 
                    />
                    <Input 
                        label="End Date" 
                        type="date" 
                        value={sprintForm.endDate || ''} 
                        onChange={e => setSprintForm({...sprintForm, endDate: e.target.value})} 
                    />
                </div>

                {duration > 0 && (
                    <div className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2.5 flex items-center justify-between">
                        <span>Sprint Duration:</span>
                        <span className="font-bold text-slate-800 dark:text-white">
                            {duration} day{duration !== 1 ? 's' : ''} ({Math.round(duration / 7 * 10) / 10} week{duration >= 14 ? 's' : ''})
                        </span>
                    </div>
                )}

                <Select 
                    label="Status" 
                    value={sprintForm.status || 'Planning'} 
                    onChange={e => setSprintForm({...sprintForm, status: e.target.value as any})}
                >
                    <option value="Planning">📋 Planning</option>
                    <option value="Active">🟢 Active</option>
                    <option value="Completed">✅ Completed</option>
                    <option value="Cancelled">❌ Cancelled</option>
                </Select>

                {(sprintForm.status === 'Completed' || sprintForm.status === 'Cancelled') && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Sprint Retrospective Notes
                        </label>
                        <textarea
                            value={sprintForm.retrospectiveNotes || ''}
                            onChange={e => setSprintForm({...sprintForm, retrospectiveNotes: e.target.value})}
                            placeholder="What went well? What could improve? What will we commit to changing?"
                            rows={4}
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleSave}>
                        {sprintForm.id ? 'Update Sprint' : 'Create Sprint'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default SprintModal;
