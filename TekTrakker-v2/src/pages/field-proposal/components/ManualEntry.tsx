import React, { useState } from 'react';
import { Calculator, Plus } from 'lucide-react';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import { useLanguage } from 'context/LanguageContext';

type Tier = 'Basic' | 'Premium' | 'Platinum';

interface ManualEntryProps {
    activeTier: Tier;
    onAdd: (item: { name: string, description: string, price: number, quantity: number, type: string, tier: Tier, isPercentage?: boolean }) => void;
}

const ManualEntry: React.FC<ManualEntryProps> = ({ activeTier, onAdd }) => {
    const [manualItem, setManualItem] = useState({ 
        name: '', 
        description: '', 
        price: '', 
        quantity: '1', 
        type: 'Part',
        isPercentage: false
    });
    const { t } = useLanguage();

    const handleAdd = () => {
        if (!manualItem.name || !manualItem.price) return;
        onAdd({
            ...manualItem,
            price: parseFloat(manualItem.price),
            quantity: parseFloat(manualItem.quantity),
            tier: activeTier,
            isPercentage: (manualItem.type === 'Fee' || manualItem.type === 'Discount') ? manualItem.isPercentage : false
        });
        setManualItem({ name: '', description: '', price: '', quantity: '1', type: 'Part', isPercentage: false });
    };

    return (
        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 mb-8 animate-fade-in">
             <h4 className="font-bold text-sm text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                 <Calculator size={16}/> {t("Manual Entry for")} {t(activeTier)} {t("Option")}
             </h4>
             <div className="flex flex-col md:flex-row gap-3 items-end [&_.mb-4]:!mb-0 [&_.mb-2]:!mb-0">
                 <div className="flex-1 w-full">
                     <Input label={t("Item Name")} value={manualItem.name} onChange={e => setManualItem({...manualItem, name: e.target.value})} placeholder={t("Service Description")} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                 </div>
                 <div className="w-full md:w-32">
                     <Select label={t("Type")} value={manualItem.type} onChange={e => setManualItem({...manualItem, type: e.target.value})}>
                         <option value="Part">{t("Part")}</option>
                         <option value="Labor">{t("Labor")}</option>
                         <option value="Part/Labor">{t("Part/Labor")}</option>
                         <option value="Fee">{t("Fee")}</option>
                         <option value="Discount">{t("Discount")}</option>
                     </Select>
                 </div>
                 <div className="w-full md:w-24">
                     <Input label={t("Qty")} type="number" value={manualItem.quantity} onChange={e => setManualItem({...manualItem, quantity: e.target.value})} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                 </div>
                 <div className="w-full md:w-32">
                     <Input label={manualItem.isPercentage && (manualItem.type === 'Fee' || manualItem.type === 'Discount') ? t("Percent (%)") : t("Price ($)")} type="number" value={manualItem.price} onChange={e => setManualItem({...manualItem, price: e.target.value})} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                 </div>
                 {(manualItem.type === 'Fee' || manualItem.type === 'Discount') && (
                     <div className="flex items-center gap-2 mb-2 md:mb-0 pb-1 h-[42px]">
                         <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 cursor-pointer select-none">
                             <input 
                                 type="checkbox" 
                                 checked={manualItem.isPercentage} 
                                 onChange={e => setManualItem({...manualItem, isPercentage: e.target.checked})}
                                 className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                             />
                             {t("Percentage (%)")}
                         </label>
                     </div>
                 )}
                 <Button onClick={handleAdd} disabled={!manualItem.name || !manualItem.price} className="h-11 w-full md:w-auto bg-blue-600 hover:bg-blue-700">
                     <Plus size={18}/> {t("Add")}
                 </Button>
             </div>
        </div>
    );
};

export default ManualEntry;
