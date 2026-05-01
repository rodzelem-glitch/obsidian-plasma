
import React, { useState } from 'react';
import { Calculator, Plus } from 'lucide-react';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';

type Tier = 'Good' | 'Better' | 'Best';

interface ManualEntryProps {
    activeTier: Tier;
    onAdd: (item: { name: string, description: string, price: number, quantity: number, type: string, tier: Tier }) => void;
}

const ManualEntry: React.FC<ManualEntryProps> = ({ activeTier, onAdd }) => {
    const [manualItem, setManualItem] = useState({ 
        name: '', 
        description: '', 
        price: '', 
        quantity: '1', 
        type: 'Part' 
    });

    const handleAdd = () => {
        if (!manualItem.name || !manualItem.price) return;
        onAdd({
            ...manualItem,
            price: parseFloat(manualItem.price),
            quantity: parseFloat(manualItem.quantity),
            tier: activeTier
        });
        setManualItem({ name: '', description: '', price: '', quantity: '1', type: 'Part' });
    };

    return (
        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 mb-8 animate-fade-in">
             <h4 className="font-bold text-sm text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                 <Calculator size={16}/> Manual Entry for {activeTier} Option
             </h4>
             <div className="flex flex-col md:flex-row gap-3 items-end [&_.mb-4]:!mb-0 [&_.mb-2]:!mb-0">
                 <div className="flex-1 w-full">
                     <Input label="Item Name" value={manualItem.name} onChange={e => setManualItem({...manualItem, name: e.target.value})} placeholder="Service Description" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                 </div>
                 <div className="w-full md:w-32">
                     <Select label="Type" value={manualItem.type} onChange={e => setManualItem({...manualItem, type: e.target.value})}>
                         <option value="Part">Part</option>
                         <option value="Labor">Labor</option>
                         <option value="Part/Labor">Part/Labor</option>
                         <option value="Fee">Fee</option>
                         <option value="Discount">Discount</option>
                     </Select>
                 </div>
                 <div className="w-full md:w-24">
                     <Input label="Qty" type="number" value={manualItem.quantity} onChange={e => setManualItem({...manualItem, quantity: e.target.value})} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                 </div>
                 <div className="w-full md:w-32">
                     <Input label="Price ($)" type="number" value={manualItem.price} onChange={e => setManualItem({...manualItem, price: e.target.value})} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                 </div>
                 <Button onClick={handleAdd} disabled={!manualItem.name || !manualItem.price} className="h-11 w-full md:w-auto bg-blue-600 hover:bg-blue-700">
                     <Plus size={18}/> Add
                 </Button>
             </div>
        </div>
    );
};

export default ManualEntry;
