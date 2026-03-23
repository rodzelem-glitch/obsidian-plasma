
import React from 'react';
import { Plus, Search, FolderKanban } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Select from '../../../../components/ui/Select';
import type { Project } from '../../../../types';

interface ProjectPageHeaderProps {
    projects: Project[];
    selectedProject: Project | null;
    onProjectSelect: (projectId: string) => void;
    onSearch: (term: string) => void;
    onNewProject: () => void;
}

const ProjectPageHeader: React.FC<ProjectPageHeaderProps> = ({ projects, selectedProject, onProjectSelect, onSearch, onNewProject }) => {
    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <FolderKanban className="text-blue-600 dark:text-blue-400" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Project Management</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage large-scale jobs & timelines</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        className="pl-9 pr-4 py-2 w-full sm:w-64 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </div>
                
                <div className="w-full sm:w-64">
                    <Select
                        label=""
                        value={selectedProject?.id || ''}
                        onChange={(e) => onProjectSelect(e.target.value)}
                    >
                         <option value="">Select a Project...</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </Select>
                </div>

                <Button onClick={onNewProject} className="flex items-center justify-center gap-2">
                    <Plus size={16} /> New Project
                </Button>
            </div>
        </div>
    );
};

export default ProjectPageHeader;
