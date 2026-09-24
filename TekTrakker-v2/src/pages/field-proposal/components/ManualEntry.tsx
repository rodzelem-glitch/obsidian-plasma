import React, { useState } from 'react';
import { Calculator, Plus } from 'lucide-react';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import { useLanguage } from 'context/LanguageContext';
import { calculateCustomerPartMarkup } from 'lib/estimatorRules';
import type { CustomerMarkupRule } from 'types';

type Tier = 'Basic' | 'Premium' | 'Platinum';

interface ManualEntryProps {
    activeTier: Tier;
    onAdd: (item: { 
        name: string; 
        description: string; 
        price: number; 
        quantity: number; 
        type: string; 
        tier: Tier; 
        isPercentage?: boolean;
        cost?: number;
        vendorCost?: number;
        partCost?: number;
        markupPct?: number;
        margin?: number;
    }) => void;
    defaultMarkupPct?: number;
    customerRules?: CustomerMarkupRule[];
}

const ManualEntry: React.FC<ManualEntryProps> = ({ activeTier, onAdd, defaultMarkupPct, customerRules }) => {
    const [manualItem, setManualItem] = useState({ 
        name: '', 
        description: '', 
        cost: '',
        markupPct: '',
        price: '', 
        quantity: '1', 
        type: 'Part',
        isPercentage: false
    });
    const { t } = useLanguage();

    const handleCostChange = (val: string) => {
        const numericCost = parseFloat(val) || 0;
        let markup = parseFloat(manualItem.markupPct);
        if (isNaN(markup) || markup === 0) {
            markup = calculateCustomerPartMarkup(numericCost, customerRules, defaultMarkupPct);
        }
        const calculatedPrice = numericCost > 0 ? (numericCost * (1 + markup / 100)).toFixed(2) : manualItem.price;
        setManualItem(prev => ({
            ...prev,
            cost: val,
            markupPct: markup.toString(),
            price: calculatedPrice
        }));
    };

    const handleMarkupChange = (val: string) => {
        const markup = parseFloat(val) || 0;
        const cost = parseFloat(manualItem.cost) || 0;
        const calculatedPrice = cost > 0 ? (cost * (1 + markup / 100)).toFixed(2) : manualItem.price;
        setManualItem(prev => ({
            ...prev,
            markupPct: val,
            price: calculatedPrice
        }));
    };

    const handlePriceChange = (val: string) => {
        const price = parseFloat(val) || 0;
        const cost = parseFloat(manualItem.cost) || 0;
        let markup = manualItem.markupPct;
        if (cost > 0) {
            markup = (((price - cost) / cost) * 100).toFixed(1);
        }
        setManualItem(prev => ({
            ...prev,
            price: val,
            markupPct: markup
        }));
    };

    const handleAdd = () => {
        if (!manualItem.name || !manualItem.price) return;
        const costNum = parseFloat(manualItem.cost) || 0;
        const markupNum = parseFloat(manualItem.markupPct) || 0;
        onAdd({
            ...manualItem,
            price: parseFloat(manualItem.price),
            quantity: parseFloat(manualItem.quantity) || 1,
            tier: activeTier,
            cost: costNum,
            vendorCost: costNum,
            partCost: costNum,
            markupPct: markupNum,
            margin: markupNum,
            isPercentage: (manualItem.type === 'Fee' || manualItem.type === 'Discount') ? manualItem.isPercentage : false
        });
        setManualItem({ name: '', description: '', cost: '', markupPct: '', price: '', quantity: '1', type: 'Part', isPercentage: false });
    };

    return (
        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 mb-8 animate-fade-in">
             <h4 className="font-bold text-sm text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                 <Calculator size={16}/> {t("Manual Entry for")} {t(activeTier)} {t("Option")}
             </h4>
             <div className="flex flex-col md:flex-row gap-3 items-end [&_.mb-4]:!mb-0 [&_.mb-2]:!mb-0 flex-wrap">
                 <div className="flex-1 min-w-[180px] w-full">
                     <Input label={t("Item Name")} value={manualItem.name} onChange={e => setManualItem({...manualItem, name: e.target.value})} placeholder={t("Service Description")} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                 </div>
                 <div className="w-full md:w-32">
                     <Select label={t("Type")} value={manualItem.type} onChange={e => setManualItem({...manualItem, type: e.target.value})}>
                         <option value="Part">{t("Part")}</option>
                         <option value="Labor">{t("Labor")}</option>
                         <option value="Part/Labor">{t("Part/Labor")}</option>
                         <option value="Fee">{t("Fee")}</option>
                         <option value="Discount">{t("Discount")}</option>
                         <option value="Service">{t("Service")}</option>
                     </Select>
                 </div>
                 <div className="w-full md:w-20">
                     <Input label={t("Qty")} type="number" value={manualItem.quantity} onChange={e => setManualItem({...manualItem, quantity: e.target.value})} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                 </div>
                 {(!manualItem.isPercentage && manualItem.type !== 'Fee' && manualItem.type !== 'Discount') && (
                     <>
                         <div className="w-full md:w-28">
                             <Input label={t("Cost ($)")} type="number" step="0.01" value={manualItem.cost} onChange={e => handleCostChange(e.target.value)} placeholder="0.00" title={t("Our internal cost before markup")} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                         </div>
                         <div className="w-full md:w-24">
                             <Input label={t("Markup %")} type="number" step="0.1" value={manualItem.markupPct} onChange={e => handleMarkupChange(e.target.value)} placeholder="0" title={t("Markup percentage")} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                         </div>
                     </>
                 )}
                 <div className="w-full md:w-28">
                     <Input label={manualItem.isPercentage && (manualItem.type === 'Fee' || manualItem.type === 'Discount') ? t("Percent (%)") : t("Price ($)")} type="number" step="0.01" value={manualItem.price} onChange={e => handlePriceChange(e.target.value)} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
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
