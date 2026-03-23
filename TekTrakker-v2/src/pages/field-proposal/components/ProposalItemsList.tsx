
import React from 'react';
import { Trash2 as TrashIcon } from 'lucide-react';

// This is the internal representation used in FieldProposal
type InternalProposalItem = {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'Part' | 'Labor' | 'Service' | 'Fee';
    tier: 'Good' | 'Better' | 'Best';
    taxable?: boolean;
};

type Tier = 'Good' | 'Better' | 'Best';

interface ProposalItemsListProps {
    items: InternalProposalItem[];
    activeTier: Tier;
    onUpdate: (id: string, field: keyof InternalProposalItem, value: any) => void;
    onDelete: (id: string) => void;
}

const ProposalItemsList: React.FC<ProposalItemsListProps> = ({ items, activeTier, onUpdate, onDelete }) => {
    const tierItems = items.filter(i => i.tier === activeTier);

    return (
        <div className="space-y-4 min-h-[100px]">
            <div className="flex justify-between items-end border-b-2 border-slate-200 dark:border-slate-700 pb-2">
                <h4 className="font-black text-xs uppercase text-slate-500 dark:text-slate-400">Items in {activeTier} Option</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">{tierItems.length} items</span>
            </div>
            
            {tierItems.length === 0 && (
                <p className="text-sm text-slate-400 italic text-center py-4 md:py-8">No items added to this option yet.</p>
            )}
            
            {tierItems.map((item) => (
                <div key={item.id} className="flex flex-col md:flex-row gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm group hover:border-primary-300 transition-colors">
                    <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 placeholder-slate-400"
                                value={item.name}
                                onChange={e => onUpdate(item.id, 'name', e.target.value)}
                                placeholder="Item Name"
                            />
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 uppercase font-bold tracking-wider self-start">{item.type}</span>
                        </div>
                        <input 
                            className="w-full text-xs text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 placeholder-slate-400"
                            value={item.description || ''}
                            onChange={e => onUpdate(item.id, 'description', e.target.value)}
                            placeholder="Description..."
                        />
                    </div>
                    
                    <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-700 pt-3 md:pt-0 md:pl-4">
                        <div className="flex flex-col w-16">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Qty</label>
                            <input 
                                type="number" 
                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded text-center font-bold text-sm p-1 text-slate-900 dark:text-white"
                                value={item.quantity}
                                onChange={e => onUpdate(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="flex flex-col w-24">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Unit Price</label>
                            <input 
                                type="number" 
                                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded text-right font-bold text-sm p-1 text-slate-900 dark:text-white"
                                value={item.unitPrice}
                                onChange={e => onUpdate(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        
                        <div className="flex flex-col items-center px-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Tax</label>
                            <input 
                                type="checkbox" 
                                checked={item.taxable !== false} 
                                onChange={e => onUpdate(item.id, 'taxable', e.target.checked)}
                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                        </div>
                        
                        <div className="w-24 text-right">
                            <label className="text-[9px] font-bold text-slate-400 uppercase block">Total</label>
                            <span className="font-black text-lg">${(item.total || 0).toFixed(2)}</span>
                        </div>

                        <button onClick={() => onDelete(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                            <TrashIcon size={18}/>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProposalItemsList;
