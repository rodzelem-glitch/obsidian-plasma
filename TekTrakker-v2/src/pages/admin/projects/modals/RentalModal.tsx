import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import type { EquipmentRental } from 'types';
import { useLanguage } from 'context/LanguageContext';

interface RentalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (rental: Partial<EquipmentRental>) => void;
    rentalForm: Partial<EquipmentRental>;
    setRentalForm: (form: Partial<EquipmentRental>) => void;
}

const RentalModal: React.FC<RentalModalProps> = ({ isOpen, onClose, onSave, rentalForm, setRentalForm }) => {
    const { t } = useLanguage();

    const handleSave = () => {
        onSave(rentalForm);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={rentalForm.id ? t("Edit Rental") : t("Log Equipment Rental")}>
            <div className="space-y-4">
                <Input label={t("Equipment Name")} value={rentalForm.equipmentName || ''} onChange={e => setRentalForm({...rentalForm, equipmentName: e.target.value})} />
                <Input label={t("Vendor")} value={rentalForm.vendor || ''} onChange={e => setRentalForm({...rentalForm, vendor: e.target.value})} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label={t("Start Date")} type="date" value={rentalForm.startDate || ''} onChange={e => setRentalForm({...rentalForm, startDate: e.target.value})} />
                    <Input label={t("End Date")} type="date" value={rentalForm.endDate || ''} onChange={e => setRentalForm({...rentalForm, endDate: e.target.value})} />
                </div>
                <Input label={t("Cost ($)")} type="number" step="0.01" value={rentalForm.cost} onChange={e => setRentalForm({...rentalForm, cost: parseFloat(e.target.value)})} />
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>{t("Cancel")}</Button>
                    <Button onClick={handleSave}>{t("Save Rental")}</Button>
                </div>
            </div>
        </Modal>
    );
}

export default RentalModal;
