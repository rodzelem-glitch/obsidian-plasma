
import React, { useState } from 'react';
import { ProjectTask, Project, ProjectNote } from 'types';
import Modal from 'components/ui/Modal';
import Textarea from 'components/ui/Textarea';
import Button from 'components/ui/Button';
import { Upload } from 'lucide-react';
import { db } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { uploadFileToStorage } from 'lib/storageService';



const ProjectTaskWorkflowModal = ({ isOpen, onClose, task, project }: { isOpen: boolean, onClose: () => void, task: ProjectTask, project: Project }) => {
    const { state, dispatch } = useAppContext();
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleUpdate = async (markComplete: boolean = false) => {
        setIsSaving(true);
        try {
            const updates: any = {};
            const updatedTasks = project.projectTasks?.map(t => {
                if (t.id === task.id) return { ...t, status: markComplete ? 'Completed' : 'In Progress' };
                return t;
            }) || [];
            updates.projectTasks = updatedTasks;

            if (notes.trim()) {
                const newNote: ProjectNote = {
                    id: `note-${Date.now()}`,
                    author: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
                    content: `[Task: ${task.description}] ${notes}`,
                    timestamp: new Date().toISOString()
                };
                updates.notesList = [...(project.notesList || []), newNote];
            }

            if (file) {
                const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'upload.jpg';
                const path = `organizations/${project.organizationId}/projects/${project.id}/files/${Date.now()}_${safeName}`;
                const downloadUrl = await uploadFileToStorage(path, file);
                const newFile = {
                    id: `file-${Date.now()}`,
                    organizationId: project.organizationId,
                    parentId: project.id,
                    parentType: 'project' as const,
                    fileName: file.name,
                    fileType: file.type,
                    dataUrl: downloadUrl,
                    createdAt: new Date().toISOString(),
                    uploadedBy: state.currentUser?.id || 'tech',
                    metadata: { taskId: task.id, label: 'Task Update' }
                };
                updates.files = [...(project.files || []), newFile];
            }

            await db.collection('projects').doc(project.id).update(updates);
            dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, ...updates } });
            setNotes(''); setFile(null); onClose();
        } catch (e) { alert("Failed to update task."); } finally { setIsSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Task Update">
            <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">{task.description}</h4>
                    <p className="text-sm text-slate-500">Project: {project.name}</p>
                </div>
                <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
                <div className="flex gap-2 items-center">
                    <label className="cursor-pointer bg-slate-100 dark:bg-slate-700 p-3 rounded-lg flex items-center gap-2 text-sm">
                        <Upload size={16}/> {file ? 'Change File' : 'Attach Photo'}
                        <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                    </label>
                    {file && <span className="text-xs text-green-600">{file.name}</span>}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => handleUpdate(false)} disabled={isSaving}>Update</Button>
                    <Button onClick={() => handleUpdate(true)} disabled={isSaving} className="bg-green-600">Complete</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ProjectTaskWorkflowModal;
