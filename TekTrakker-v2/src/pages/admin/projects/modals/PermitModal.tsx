import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import type { Permit } from 'types';

interface PermitModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (permit: Partial<Permit>) => void;
    permitForm: Partial<Permit>;
    setPermitForm: (form: Partial<Permit>) => void;
}

const PermitModal: React.FC<PermitModalProps> = ({ isOpen, onClose, onSave, permitForm, setPermitForm }) => {

    const handleSave = () => {
        onSave(permitForm);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={permitForm.id ? "Edit Permit" : "Add Permit"}>
            <div className="space-y-4">
                <Input label="Permit Number" value={permitForm.number || ''} onChange={e => setPermitForm({...permitForm, number: e.target.value})} />
                <Input label="Permit Type" value={permitForm.type || ''} onChange={e => setPermitForm({...permitForm, type: e.target.value})} />
                <Select label="Status" value={permitForm.status} onChange={e => setPermitForm({...permitForm, status: e.target.value as any})}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                </Select>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Issue Date" type="date" value={permitForm.issueDate || ''} onChange={e => setPermitForm({...permitForm, issueDate: e.target.value})} />
                    <Input label="Expiration Date" type="date" value={permitForm.expirationDate || ''} onChange={e => setPermitForm({...permitForm, expirationDate: e.target.value})} />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Permit</Button>
                </div>
            </div>
        </Modal>
    );
}

export default PermitModal;
