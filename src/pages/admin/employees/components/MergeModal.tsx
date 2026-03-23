
import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Select from 'components/ui/Select';
import { User } from 'types';
import { Trash2 } from 'lucide-react';
import { db } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { globalConfirm } from "lib/globalConfirm";

interface MergeModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: User[];
}

const MergeModal: React.FC<MergeModalProps> = ({ isOpen, onClose, employees }) => {
    const { state } = useAppContext();
    const [masterId, setMasterId] = useState('');
    const [duplicateId, setDuplicateId] = useState('');
    const [isMerging, setIsMerging] = useState(false);

    const handleMerge = async () => {
        if (state.isDemoMode) {
            alert("This feature is disabled in demo mode.");
            return;
        }

        if (!masterId || !duplicateId || masterId === duplicateId) {
            alert("Please select distinct Master and Duplicate profiles.");
            return;
        }

        const orgId = state.currentOrganization?.id;
        if (!orgId) {
            alert("Organization context lost.");
            return;
        }
        
        const masterUser = employees.find(u => u.id === masterId);
        const duplicateUser = employees.find(u => u.id === duplicateId);
        const masterHasAuth = masterUser?.uid && !masterUser.uid.includes('@');
        const duplicateHasAuth = duplicateUser?.uid && !duplicateUser.uid.includes('@');

        let finalMasterId = masterId;
        let finalDuplicateId = duplicateId;
        let finalMasterUser = masterUser;

        if (duplicateHasAuth && !masterHasAuth) {
            finalMasterId = duplicateId;
            finalDuplicateId = masterId;
            finalMasterUser = duplicateUser;
            if(!await globalConfirm(`Login UID detected on Duplicate. We will SWAP them to preserve login access.\n\nProfile "${duplicateUser?.firstName}" will be kept.\nProfile "${masterUser?.firstName}" will be deleted.\n\nProceed?`)) return;
        } else {
             if (!await globalConfirm("This will permanently delete the Duplicate profile and reassign all their history to the Master profile. Continue?")) return;
        }
        
        setIsMerging(true);
        try {
            const batch = db.batch();
            
            const jobsSnap = await db.collection('jobs').where('assignedTechnicianId', '==', finalDuplicateId).where('organizationId', '==', orgId).get();
            jobsSnap.forEach(doc => batch.update(doc.ref, { assignedTechnicianId: finalMasterId, assignedTechnicianName: finalMasterUser?.firstName || 'Assigned' }));
            
            const shiftsSnap = await db.collection('shiftLogs').where('userId', '==', finalDuplicateId).where('organizationId', '==', orgId).get();
            shiftsSnap.forEach(doc => batch.update(doc.ref, { userId: finalMasterId }));

            const vehicleLogsSnap = await db.collection('vehicleLogs').where('userId', '==', finalDuplicateId).where('organizationId', '==', orgId).get();
            vehicleLogsSnap.forEach(doc => batch.update(doc.ref, { userId: finalMasterId }));
            
            const duplicateRef = db.collection('users').doc(finalDuplicateId);
            batch.delete(duplicateRef);

            await batch.commit();
            alert("Merge successful.");
            onClose();
        } catch(e: any) {
            alert("Merge failed: " + e.message);
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Merge Duplicate Employees">
            <div className="space-y-4">
                 <div className="bg-amber-50 p-4 rounded-lg border text-sm text-amber-800">
                     <p className="font-bold mb-2 flex items-center gap-2"><Trash2 size={16}/> Warning: Destructive Action</p>
                     <p>All history from the <strong>Duplicate</strong> profile will be reassigned to the <strong>Master</strong> profile. The Duplicate profile will be permanently deleted.</p>
                 </div>
                 
                 <Select label="Master Profile (Keep this one)" value={masterId} onChange={e => setMasterId(e.target.value)}>
                     <option value="">-- Select Master --</option>
                     {employees.map(u => (
                         <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email}) {u.uid && !u.uid.includes('@') ? '[AUTH]' : ''}</option>
                     ))}
                 </Select>
                 
                 <Select label="Duplicate Profile (Delete this one)" value={duplicateId} onChange={e => setDuplicateId(e.target.value)}>
                     <option value="">-- Select Duplicate --</option>
                     {employees.filter(u => u.id !== masterId).map(u => (
                         <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email}) {u.uid && !u.uid.includes('@') ? '[AUTH]' : ''}</option>
                     ))}
                 </Select>
                 
                 <div className="flex justify-end gap-2 pt-4">
                     <Button variant="secondary" onClick={onClose}>Cancel</Button>
                     <Button onClick={handleMerge} disabled={!masterId || !duplicateId || isMerging} className="bg-red-600 hover:bg-red-700 text-white">
                         {isMerging ? 'Merging...' : 'Confirm Merge'}
                     </Button>
                 </div>
            </div>
        </Modal>
    );
};

export default MergeModal;
