
import React from 'react';
import Modal from '../../../../components/ui/Modal';
import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';
import type { EquipmentRental } from '../../../../types';

interface RentalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rental: Partial<EquipmentRental>) => void;
    rental: Partial<EquipmentRental> | null;
}

const RentalModal: React.FC<RentalModalProps> = ({ isOpen, onClose, onSave, rental }) => {
    const [rentalForm, setRentalForm] = React.useState<Partial<EquipmentRental>>({});

    React.useEffect(() => {
        if (rental) {
            setRentalForm(rental);
        } else {
            setRentalForm({ status: 'Active', cost: 0 });
        }
    }, [rental]);

    const handleSave = () => {
        onSave(rentalForm);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Log Equipment Rental">
            <div className="space-y-4">
                <Input label="Equipment Name" value={rentalForm.equipmentName || ''} onChange={e => setRentalForm({...rentalForm, equipmentName: e.target.value})} />
                <Input label="Vendor" value={rentalForm.vendor || ''} onChange={e => setRentalForm({...rentalForm, vendor: e.target.value})} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Start Date" type="date" value={rentalForm.startDate || ''} onChange={e => setRentalForm({...rentalForm, startDate: e.target.value})} />
                    <Input label="End Date" type="date" value={rentalForm.endDate || ''} onChange={e => setRentalForm({...rentalForm, endDate: e.target.value})} />
                </div>
                <Input label="Cost" type="number" value={rentalForm.cost || 0} onChange={e => setRentalForm({...rentalForm, cost: Number(e.target.value)})} />
                <Button onClick={handleSave}>Save Rental Log</Button>
            </div>
        </Modal>
    );
};

export default RentalModal;
