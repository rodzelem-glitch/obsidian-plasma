
import React from 'react';
import { Trash2, PlusCircle, Tag } from 'lucide-react';
import Button from '../../ui/Button';
import type { InvoiceLineItem } from '../../../types';
import Select from '../../ui/Select';
import Input from '../../ui/Input';

interface LineItemsListProps {
    lineItems: InvoiceLineItem[];
    handleUpdateItem: (id: string, field: keyof InvoiceLineItem, value: any) => void;
    handleDeleteItem: (id: string) => void;
    handleAddItem: (type?: InvoiceLineItem['type'], description?: string) => void;
    setIsDiscountModalOpen: (open: boolean) => void;
}

const LineItemsList: React.FC<LineItemsListProps> = ({
    lineItems,
    handleUpdateItem,
    handleDeleteItem,
    handleAddItem,
    setIsDiscountModalOpen
}) => {
    return (
        <div className="flex-1 min-h-[300px] flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner mt-4">
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {lineItems.map(item => (
                    <div key={item.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 shadow-sm transition-all hover:border-primary-400">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1 w-full space-y-2">
                                <input 
                                    className="w-full font-bold text-base bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-md p-2.5 text-slate-900 dark:text-white"
                                    value={item.name || ''}
                                    onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                    placeholder="Item Name (e.g. AC Unit)"
                                />
                                <textarea 
                                    className="w-full min-h-[60px] h-auto font-medium text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-md p-2.5 text-slate-600 dark:text-slate-300 resize-none shadow-inner"
                                    value={item.description || ''}
                                    onChange={(e) => {
                                        handleUpdateItem(item.id, 'description', e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    placeholder="Detailed description..."
                                    rows={2}
                                />
                            </div>
                            <button 
                                onClick={() => handleDeleteItem(item.id)} 
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors flex-shrink-0 mt-1"
                                title="Remove item"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap items-end justify-between gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                            {/* Left-aligned inputs */}
                            <div className="flex flex-wrap items-end gap-3 text-xs text-slate-600 dark:text-slate-400 [&_.mb-4]:!mb-0">
                                <div className="w-20">
                                    <Input 
                                        label="Qty"
                                        type="number" 
                                        value={item.quantity === 0 ? '' : item.quantity}
                                        onChange={e => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        onFocus={e => e.target.select()}
                                        className="h-[34px] !py-0 text-center bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                                        aria-label="Quantity"
                                        title="Quantity"
                                    />
                                </div>
                                <div className="w-28">
                                    <Input 
                                        label="Price ($)"
                                        type="number" 
                                        value={item.unitPrice === 0 ? '' : item.unitPrice}
                                        onChange={e => handleUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                        onFocus={e => e.target.select()}
                                        step="0.01"
                                        className="h-[34px] !py-0 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                                        aria-label="Unit Price"
                                        title="Unit Price"
                                    />
                                </div>
                                <div className="w-32 [&_.mb-2]:!mb-0">
                                    <Select 
                                        label="Type"
                                        value={item.type}
                                        onChange={e => handleUpdateItem(item.id, 'type', e.target.value as InvoiceLineItem['type'])}
                                        className="h-[34px] !py-0 !text-sm bg-white dark:bg-slate-700 sm:text-sm border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                                    >
                                        <option value="Labor">Labor</option>
                                        <option value="Part">Part</option>
                                        <option value="Part/Labor">Part/Labor</option>
                                        <option value="Fee">Fee</option>
                                        <option value="Discount">Discount</option>
                                    </Select>
                                </div>
                            </div>

                            {/* Right-aligned controls */}
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold cursor-pointer pb-2"> 
                                    <input 
                                        type="checkbox" 
                                        checked={item.taxable !== false}
                                        onChange={e => handleUpdateItem(item.id, 'taxable', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    Taxable
                                </label>
                                <p className="font-black text-slate-900 dark:text-white text-xl min-w-[90px] text-right">
                                    ${(item.quantity * item.unitPrice).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
                
                {lineItems.length === 0 && (
                    <div className="text-center py-12 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                        <p className="text-slate-500 dark:text-slate-400 font-medium">No items have been added to this invoice yet.</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Click "Add Item" below to start.</p>
                    </div>
                )}
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-xl flex gap-3">
                <Button onClick={() => handleAddItem()} variant="secondary" className="flex-1 font-bold">
                    <PlusCircle size={16} className="mr-2"/> Add Line Item
                </Button>
                <Button onClick={() => setIsDiscountModalOpen(true)} variant="secondary" className="font-bold px-6">
                    <Tag size={16} className="mr-2"/> Discount
                </Button>
            </div>
        </div>
    );
};

export default LineItemsList;
