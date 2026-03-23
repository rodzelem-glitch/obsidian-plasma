import React from 'react';
import type { EquipmentRental } from 'types';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';

interface RentalsTabProps {
    rentals: EquipmentRental[];
    onAddRental: () => void;
    onEditRental: (rental: EquipmentRental) => void;
}

const RentalsTab: React.FC<RentalsTabProps> = ({ rentals, onAddRental, onEditRental }) => {
    return (
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg">
            <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Equipment Rentals</h3>
                <Button onClick={onAddRental} className="text-xs w-auto">+ Log Rental</Button>
            </div>
            <Table headers={['Equipment', 'Vendor', 'Dates', 'Cost', 'Action']}>
                {rentals.map(rent => (
                    <tr key={rent.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80">
                        <td className="px-6 py-4 font-bold">{rent.equipmentName}</td>
                        <td className="px-6 py-4">{rent.vendor}</td>
                        <td className="px-6 py-4 text-sm">{rent.startDate} to {rent.endDate}</td>
                        <td className="px-6 py-4 font-mono">${rent.cost.toLocaleString()}</td>
                        <td className="px-6 py-4"><button onClick={() => onEditRental(rent)} className="text-blue-600 hover:underline text-xs">Edit</button></td>
                    </tr>
                ))}
                 {rentals.length === 0 && <tr><td colSpan={5} className="p-4 md:p-8 text-center text-slate-500">No rentals found.</td></tr>}
            </Table>
        </div>
    );
};

export default RentalsTab;
