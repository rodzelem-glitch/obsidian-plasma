import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import type { Subcontractor } from 'types';

interface SubcontractorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (subcontractor: Partial<Subcontractor>) => void;
    subcontractorForm: Partial<Subcontractor>;
    setSubcontractorForm: (form: Partial<Subcontractor>) => void;
}

const SubcontractorModal: React.FC<SubcontractorModalProps> = ({ isOpen, onClose, onSave, subcontractorForm, setSubcontractorForm }) => {

    const handleSave = () => {
        onSave(subcontractorForm);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={subcontractorForm.id ? "Edit Subcontractor" : "Add Subcontractor"}>
            <div className="space-y-4">
                <Input label="Company Name" value={subcontractorForm.companyName || ''} onChange={e => setSubcontractorForm({...subcontractorForm, companyName: e.target.value})} />
                <Input label="Trade" value={subcontractorForm.trade || ''} onChange={e => setSubcontractorForm({...subcontractorForm, trade: e.target.value})} />
                <Input label="Contact Name" value={subcontractorForm.contactName || ''} onChange={e => setSubcontractorForm({...subcontractorForm, contactName: e.target.value})} />
                <Input label="Contact Phone" value={subcontractorForm.contactPhone || ''} onChange={e => setSubcontractorForm({...subcontractorForm, contactPhone: e.target.value})} />
                <Select label="Status" value={subcontractorForm.status} onChange={e => setSubcontractorForm({...subcontractorForm, status: e.target.value as any})}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="On-site">On-site</option>
                    <option value="Completed">Completed</option>
                </Select>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Subcontractor</Button>
                </div>
            </div>
        </Modal>
    );
}

export default SubcontractorModal;