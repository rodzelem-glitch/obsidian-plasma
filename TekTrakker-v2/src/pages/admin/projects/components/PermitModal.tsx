
import React from 'react';
import Modal from '../../../../components/ui/Modal';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Button from '../../../../components/ui/Button';
import type { Permit } from '../../../../types';

interface PermitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (permit: Partial<Permit>, file: File | null) => void;
    permit: Partial<Permit> | null;
}

const PermitModal: React.FC<PermitModalProps> = ({ isOpen, onClose, onSave, permit }) => {
    const [permitForm, setPermitForm] = React.useState<Partial<Permit>>({});
    const [permitFile, setPermitFile] = React.useState<File | null>(null);

    React.useEffect(() => {
        if (permit) {
            setPermitForm(permit);
        } else {
            setPermitForm({ status: 'Pending', type: '' });
        }
    }, [permit]);

    const handleSave = () => {
        onSave(permitForm, permitFile);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Permit">
             <div className="space-y-4">
                <Input label="Permit #" value={permitForm.number || ''} onChange={e => setPermitForm({...permitForm, number: e.target.value})} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Type" value={permitForm.type} onChange={e => setPermitForm({...permitForm, type: e.target.value})}>
                         <option value="Building">Building</option><option value="Electrical">Electrical</option><option value="Plumbing">Plumbing</option><option value="Mechanical">Mechanical</option>
                    </Select>
                    <Select label="Status" value={permitForm.status} onChange={e => setPermitForm({...permitForm, status: e.target.value as any})}>
                         <option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Failed">Failed</option><option value="Closed">Closed</option>
                    </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Issue Date" type="date" value={permitForm.issueDate || ''} onChange={e => setPermitForm({...permitForm, issueDate: e.target.value})} />
                    <Input label="Inspection Date" type="date" value={permitForm.inspectionDate || ''} onChange={e => setPermitForm({...permitForm, inspectionDate: e.target.value})} />
                </div>
                <div className="border p-2 rounded">
                    <p className="text-xs mb-1">Upload Doc</p>
                    <input type="file" onChange={e => setPermitFile(e.target.files?.[0] || null)} />
                </div>
                <Button onClick={handleSave}>Save Permit</Button>
             </div>
        </Modal>
    );
};

export default PermitModal;
