
import React from 'react';
import Card from '../../../../../components/ui/Card';
import Table from '../../../../../components/ui/Table';
import Button from '../../../../../components/ui/Button';
import type { EquipmentRental } from '../../../../../types';

interface RentalsTabProps {
    rentals: EquipmentRental[];
    onRentalAdd: () => void;
    onRentalEdit: (rental: EquipmentRental) => void;
}

const RentalsTab: React.FC<RentalsTabProps> = ({ rentals, onRentalAdd, onRentalEdit }) => {
    return (
        <Card>
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Rentals</h3>
                <Button onClick={onRentalAdd} className="text-xs w-auto">+ Log Rental</Button>
             </div>
             <Table headers={['Equipment', 'Vendor', 'Dates', 'Cost', 'Action']}>
                {rentals.map(rent => (
                    <tr key={rent.id}>
                        <td className="px-6 py-4 font-bold">{rent.equipmentName}</td>
                        <td className="px-6 py-4">{rent.vendor}</td>
                        <td className="px-6 py-4 text-sm">{rent.startDate}</td>
                        <td className="px-6 py-4 font-mono">${rent.cost}</td>
                        <td className="px-6 py-4">
                            <button onClick={() => onRentalEdit(rent)} className="text-blue-600 hover:underline text-xs">Edit</button>
                        </td>
                    </tr>
                ))}
            </Table>
        </Card>
    );
};

export default RentalsTab;
