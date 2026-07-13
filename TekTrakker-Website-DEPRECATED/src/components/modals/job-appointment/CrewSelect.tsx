
import React from 'react';
import type { User } from '../../../types';

interface CrewSelectProps {
    orgTechs: User[];
    technicianId: string;
    assistantIds: string[];
    toggleAssistant: (id: string) => void;
}

const CrewSelect: React.FC<CrewSelectProps> = ({ orgTechs, technicianId, assistantIds, toggleAssistant }) => {
    return (
        <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded border grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {orgTechs.filter(t => t.id !== technicianId).map(tech => (
                <label key={tech.id} className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={assistantIds.includes(tech.id)} onChange={() => toggleAssistant(tech.id)} /> {tech.firstName} {tech.lastName}</label>
            ))}
        </div>
    );
};

export default CrewSelect;
