import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import type { ProjectTask, User, Project, Sprint } from 'types';
import { Plus, X, MessageSquare, CheckSquare, Tag, Clock } from 'lucide-react';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Partial<ProjectTask>) => void;
    taskForm: Partial<ProjectTask>;
    setTaskForm: (form: Partial<ProjectTask>) => void;
    employees: User[];
    project?: Project;
}

const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13, 21];

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, taskForm, setTaskForm, employees, project }) => {
    const [newLabel, setNewLabel] = useState('');
    const [newCriteria, setNewCriteria] = useState('');
    const [activeSection, setActiveSection] = useState<'details' | 'agile' | 'criteria'>('details');

    const handleSave = () => {
        onSave({
            ...taskForm,
            createdAt: taskForm.createdAt || new Date().toISOString(),
            completedAt: taskForm.status === 'Completed' && !taskForm.completedAt ? new Date().toISOString() : taskForm.completedAt,
        });
    };

    const addLabel = () => {
        if (!newLabel.trim()) return;
        setTaskForm({ ...taskForm, labels: [...(taskForm.labels || []), newLabel.trim()] });
        setNewLabel('');
    };

    const removeLabel = (idx: number) => {
        const updated = [...(taskForm.labels || [])];
        updated.splice(idx, 1);
        setTaskForm({ ...taskForm, labels: updated });
    };

    const addCriteria = () => {
        if (!newCriteria.trim()) return;
        setTaskForm({ ...taskForm, acceptanceCriteria: [...(taskForm.acceptanceCriteria || []), newCriteria.trim()] });
        setNewCriteria('');
    };

    const removeCriteria = (idx: number) => {
        const updated = [...(taskForm.acceptanceCriteria || [])];
        updated.splice(idx, 1);
        setTaskForm({ ...taskForm, acceptanceCriteria: updated });
    };

    const activeSprints = project?.sprints?.filter(s => s.status === 'Planning' || s.status === 'Active') || [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={taskForm.id ? 'Edit Task' : 'Create Task'}>
            <div className="space-y-4">
                {/* Section Tabs */}
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {[
                        { id: 'details' as const, label: 'Details', icon: Clock },
                        { id: 'agile' as const, label: 'Agile', icon: Tag },
                        { id: 'criteria' as const, label: 'Acceptance', icon: CheckSquare },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSection(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                                activeSection === tab.id
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeSection === 'details' && (
                    <>
                        <Input label="Task Description" value={taskForm.description || ''} onChange={e => setTaskForm({...taskForm, description: e.target.value})} placeholder="What needs to be done?" />
                        
                        {/* WBS Placement */}
                        {project && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-y border-slate-100 dark:border-slate-800 py-3">
                                <Select label="Phase" value={taskForm.phaseId || ''} onChange={e => {
                                    setTaskForm({...taskForm, phaseId: e.target.value, deliverableId: '', workPackageId: ''});
                                }}>
                                    <option value="">-- Project Level --</option>
                                    {project.phases?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </Select>
                                
                                <Select label="Deliverable" value={taskForm.deliverableId || ''} onChange={e => {
                                    const deliverableId = e.target.value;
                                    let phaseId = taskForm.phaseId;
                                    if (deliverableId && !phaseId) {
                                        const phase = project.phases?.find(p => p.deliverables?.some(d => d.id === deliverableId));
                                        if (phase) phaseId = phase.id;
                                    }
                                    setTaskForm({...taskForm, phaseId, deliverableId, workPackageId: ''});
                                }}>
                                    <option value="">-- Phase Level --</option>
                                    {(taskForm.phaseId 
                                        ? project.phases?.filter(p => p.id === taskForm.phaseId) 
                                        : project.phases || []
                                    )?.flatMap(p => p.deliverables || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </Select>
                                
                                <Select label="Work Package" value={taskForm.workPackageId || ''} onChange={e => {
                                    const workPackageId = e.target.value;
                                    let phaseId = taskForm.phaseId;
                                    let deliverableId = taskForm.deliverableId;
                                    if (workPackageId && !deliverableId) {
                                        for (const phase of (project.phases || [])) {
                                            for (const deliv of (phase.deliverables || [])) {
                                                if (deliv.workPackages?.some(wp => wp.id === workPackageId)) {
                                                    phaseId = phase.id;
                                                    deliverableId = deliv.id;
                                                    break;
                                                }
                                            }
                                            if (deliverableId) break;
                                        }
                                    }
                                    setTaskForm({...taskForm, phaseId, deliverableId, workPackageId});
                                }}>
                                    <option value="">-- Deliverable Level --</option>
                                    {(taskForm.deliverableId 
                                        ? project.phases?.flatMap(p => p.deliverables || []).filter(d => d.id === taskForm.deliverableId)
                                        : taskForm.phaseId 
                                            ? project.phases?.filter(p => p.id === taskForm.phaseId).flatMap(p => p.deliverables || [])
                                            : project.phases?.flatMap(p => p.deliverables || []) || []
                                    )?.flatMap(d => d.workPackages || []).map(wp => <option key={wp.id} value={wp.id}>{wp.name}</option>)}
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Select label="Status" value={taskForm.status || 'Pending'} onChange={e => setTaskForm({...taskForm, status: e.target.value as any})}>
                                <option value="Pending">📋 Pending</option>
                                <option value="In Progress">🔄 In Progress</option>
                                <option value="Blocked">🚫 Blocked</option>
                                <option value="Review">👀 Review</option>
                                <option value="Completed">✅ Completed</option>
                            </Select>
                            <Select label="Priority" value={taskForm.priority || ''} onChange={e => setTaskForm({...taskForm, priority: e.target.value as any})}>
                                <option value="">-- None --</option>
                                <option value="Low">🟢 Low</option>
                                <option value="Medium">🟡 Medium</option>
                                <option value="High">🟠 High</option>
                                <option value="Critical">🔴 Critical</option>
                            </Select>
                        </div>

                        {taskForm.status === 'Blocked' && (
                            <Input label="Blocked Reason" value={taskForm.blockedReason || ''} onChange={e => setTaskForm({...taskForm, blockedReason: e.target.value})} placeholder="Why is this blocked?" />
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Due Date" type="date" value={taskForm.dueDate || ''} onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})} />
                            <Select label="Assigned To" value={taskForm.assignedTo || ''} onChange={e => setTaskForm({...taskForm, assignedTo: e.target.value})}>
                                <option value="">-- Unassigned --</option>
                                {employees.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                            </Select>
                        </div>

                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={taskForm.isBenchmark || false} onChange={e => setTaskForm({...taskForm, isBenchmark: e.target.checked})} className="rounded border-slate-300" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">🏁 Milestone / Benchmark</span>
                        </label>
                    </>
                )}

                {activeSection === 'agile' && (
                    <>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Story Points</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {STORY_POINT_OPTIONS.map(sp => (
                                        <button
                                            key={sp}
                                            onClick={() => setTaskForm({...taskForm, storyPoints: taskForm.storyPoints === sp ? undefined : sp})}
                                            className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                                                taskForm.storyPoints === sp
                                                    ? 'bg-blue-600 text-white shadow-md scale-110'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                            }`}
                                        >
                                            {sp}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <Input label="Est. Hours" type="number" value={taskForm.estimatedHours?.toString() || ''} onChange={e => setTaskForm({...taskForm, estimatedHours: parseFloat(e.target.value) || undefined})} placeholder="0" />
                            <Input label="Actual Hours" type="number" value={taskForm.actualHours?.toString() || ''} onChange={e => setTaskForm({...taskForm, actualHours: parseFloat(e.target.value) || undefined})} placeholder="0" />
                        </div>

                        {activeSprints.length > 0 && (
                            <Select label="Sprint" value={taskForm.sprintId || ''} onChange={e => setTaskForm({...taskForm, sprintId: e.target.value || undefined})}>
                                <option value="">-- Backlog (No Sprint) --</option>
                                {activeSprints.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.status === 'Active' ? '🟢 Active' : '📋 Planning'})
                                    </option>
                                ))}
                            </Select>
                        )}

                        {/* Labels */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Labels / Tags</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {(taskForm.labels || []).map((label, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                                        {label}
                                        <button onClick={() => removeLabel(idx)} className="hover:text-red-600" aria-label="Remove label"><X size={12} /></button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={newLabel}
                                    onChange={e => setNewLabel(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLabel())}
                                    placeholder="Add a label..."
                                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                                <Button onClick={addLabel} variant="secondary" className="text-xs h-8 px-3"><Plus size={14} /></Button>
                            </div>
                        </div>
                    </>
                )}

                {activeSection === 'criteria' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                <CheckSquare size={14} className="inline mr-1" />
                                Acceptance Criteria (Definition of Done)
                            </label>
                            <div className="space-y-2 mb-3">
                                {(taskForm.acceptanceCriteria || []).map((criteria, idx) => (
                                    <div key={idx} className="flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <CheckSquare size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">{criteria}</span>
                                        <button onClick={() => removeCriteria(idx)} className="text-slate-400 hover:text-red-500" aria-label="Remove criteria"><X size={14} /></button>
                                    </div>
                                ))}
                                {(taskForm.acceptanceCriteria || []).length === 0 && (
                                    <p className="text-sm text-slate-400 italic p-3 text-center bg-slate-50 dark:bg-slate-800 rounded-lg">No acceptance criteria defined yet.</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={newCriteria}
                                    onChange={e => setNewCriteria(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCriteria())}
                                    placeholder="e.g., All wiring passes inspection..."
                                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                                <Button onClick={addCriteria} variant="secondary" className="text-xs h-8 px-3"><Plus size={14} /> Add</Button>
                            </div>
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleSave}>
                        {taskForm.id ? 'Update Task' : 'Create Task'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default TaskModal;
