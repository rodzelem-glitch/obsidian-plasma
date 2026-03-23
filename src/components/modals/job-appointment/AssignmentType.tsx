
import React from 'react';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import { UserIcon, Building2, Users, Plus } from 'lucide-react';
import type { User, Organization } from '../../../types';

interface AssignmentTypeProps {
    assignMode: 'internal' | 'partner';
    setAssignMode: (mode: 'internal' | 'partner') => void;
    technicianId: string;
    setTechnicianId: (id: string) => void;
    partnerId: string;
    setPartnerId: (id: string) => void;
    orgTechs: User[];
    partners: Organization[];
    showCrewSelect: boolean;
    setShowCrewSelect: (show: boolean) => void;
    assistantIds: string[];
    openAddSubcontractorModal: () => void;
}

const AssignmentType: React.FC<AssignmentTypeProps> = ({ 
    assignMode, 
    setAssignMode, 
    technicianId, 
    setTechnicianId, 
    partnerId, 
    setPartnerId, 
    orgTechs, 
    partners, 
    showCrewSelect, 
    setShowCrewSelect, 
    assistantIds,
    openAddSubcontractorModal
}) => {
    return (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex gap-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg mb-4">
                <button type="button" onClick={() => setAssignMode('internal')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${assignMode === 'internal' ? 'bg-white shadow text-primary-700' : 'text-slate-500'}`}><UserIcon size={14}/> Internal Tech</button>
                <button type="button" onClick={() => setAssignMode('partner')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${assignMode === 'partner' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'}`}><Building2 size={14}/> Subcontractor</button>
            </div>

            {assignMode === 'internal' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Lead Tech" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
                        <option value="">Unassigned</option>
                        {orgTechs.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                    </Select>
                    <div className="flex items-end">
                        <Button type="button" variant="secondary" onClick={() => setShowCrewSelect(!showCrewSelect)} className="text-xs h-10 w-full"><Users size={14} className="mr-2"/> Crew ({assistantIds.length})</Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Select Partner Organization" value={partnerId} onChange={e => setPartnerId(e.target.value)}>
                        <option value="">-- Choose Partner --</option>
                        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        {partners.length === 0 && <option disabled>No partners linked yet</option>}
                    </Select>
                    <div className="flex items-end">
                        <Button type="button" variant="secondary" onClick={openAddSubcontractorModal} className="text-xs h-10 w-full"><Plus size={14} className="mr-2"/> Add Subcontractor</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignmentType;
