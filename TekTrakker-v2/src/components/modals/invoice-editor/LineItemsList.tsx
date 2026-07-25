
import React from 'react';
import { Trash2, PlusCircle, Tag, ChevronUp, ChevronDown } from 'lucide-react';
import Button from '../../ui/Button';
import type { InvoiceLineItem } from '../../../types';


interface LineItemsListProps {
    lineItems: InvoiceLineItem[];
    handleUpdateItem: (id: string, field: keyof InvoiceLineItem, value: string | number | boolean) => void;
    handleDeleteItem: (id: string) => void;
    handleAddItem: (type?: InvoiceLineItem['type'], description?: string) => void;
    setIsDiscountModalOpen: (open: boolean) => void;
    contractedRate?: number;
    handleMoveItem?: (id: string, direction: 'up' | 'down') => void;
}

const LineItemsList: React.FC<LineItemsListProps> = ({
    lineItems,
    handleUpdateItem,
    handleDeleteItem,
    handleAddItem,
    setIsDiscountModalOpen,
    contractedRate,
    handleMoveItem
}) => {
    return (
        <div className="flex-1 min-h-[300px] flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner mt-4">
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {lineItems.map((item, index) => (
                    <div key={item.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 shadow-sm transition-all hover:border-primary-400 flex gap-3 items-center">
                        {handleMoveItem && (
                            <div className="flex flex-col gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleMoveItem(item.id, 'up')}
                                    disabled={index === 0}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                    title="Move up"
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleMoveItem(item.id, 'down')}
                                    disabled={index === lineItems.length - 1}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                    title="Move down"
                                >
                                    <ChevronDown size={16} />
                                </button>
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
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
                            <div className="flex flex-wrap items-end gap-3 sm:gap-4 text-xs text-slate-600 dark:text-slate-400">
                                <div className="flex flex-col gap-1 w-16 sm:w-20">
                                    <label htmlFor={`qty-${item.id}`} className="font-semibold px-1">Qty</label>
                                    <input 
                                        id={`qty-${item.id}`}
                                        type="number" 
                                        value={item.quantity === 0 ? '' : item.quantity}
                                        onChange={e => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        onFocus={e => e.target.select()}
                                        className="h-10 text-center bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded focus:ring-1 focus:ring-primary-500 font-medium"
                                        aria-label="Quantity"
                                        title="Quantity"
                                    />
                                </div>
                                {item.type === 'Discount' && (
                                    <div className="flex flex-col gap-1 w-20 sm:w-24">
                                        <label htmlFor={`method-${item.id}`} className="font-semibold px-1">Method</label>
                                        <select
                                            id={`method-${item.id}`}
                                            value={item.isPercentage ? 'percent' : 'flat'}
                                            onChange={e => {
                                                const isPct = e.target.value === 'percent';
                                                handleUpdateItem(item.id, 'isPercentage', isPct);
                                                if (isPct) {
                                                    handleUpdateItem(item.id, 'percentageRate', 10); // default to 10%
                                                }
                                            }}
                                            className="h-10 px-2 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded focus:ring-1 focus:ring-primary-500 text-sm font-medium"
                                            title="Discount Method"
                                        >
                                            <option value="flat">Flat ($)</option>
                                            <option value="percent">Percent (%)</option>
                                        </select>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 w-24 sm:w-28">
                                    <label htmlFor={`price-${item.id}`} className="font-semibold px-1">
                                        {item.type === 'Discount' ? (item.isPercentage ? 'Discount (%)' : 'Discount ($)') : 'Price ($)'}
                                    </label>
                                    <input 
                                        id={`price-${item.id}`}
                                        type="number" 
                                        value={
                                            item.type === 'Discount' 
                                                ? (item.isPercentage ? (item.percentageRate === 0 ? '' : item.percentageRate) : (item.unitPrice === 0 ? '' : Math.abs(item.unitPrice)))
                                                : (item.unitPrice === 0 ? '' : item.unitPrice)
                                        }
                                        onChange={e => {
                                            const val = parseFloat(e.target.value) || 0;
                                            if (item.type === 'Discount' && item.isPercentage) {
                                                handleUpdateItem(item.id, 'percentageRate', val);
                                            } else {
                                                handleUpdateItem(item.id, 'unitPrice', val);
                                            }
                                        }}
                                        onFocus={e => e.target.select()}
                                        step="0.01"
                                        className="h-10 pl-3 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded focus:ring-1 focus:ring-primary-500 font-medium"
                                        aria-label="Unit Price"
                                        title="Unit Price"
                                    />
                                    {contractedRate !== undefined && contractedRate > 0 && (item.type === 'Labor' || item.type === 'Part/Labor') && (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateItem(item.id, 'unitPrice', contractedRate)}
                                            className="text-[9px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-500 font-extrabold underline leading-tight mt-0.5 text-left"
                                            title="Apply contracted rate"
                                        >
                                            Apply Contracted (${contractedRate.toFixed(2)})
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 w-28 sm:w-32">
                                    <label htmlFor={`type-${item.id}`} className="font-semibold px-1">Type</label>
                                    <select 
                                        id={`type-${item.id}`}
                                        value={item.type}
                                        onChange={e => handleUpdateItem(item.id, 'type', e.target.value as InvoiceLineItem['type'])}
                                        className="h-10 px-2 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded focus:ring-1 focus:ring-primary-500 text-sm font-medium"
                                        aria-label="Type"
                                        title="Type"
                                    >
                                        <option value="Labor">Labor</option>
                                        <option value="Part">Part</option>
                                        <option value="Part/Labor">Part/Labor</option>
                                        <option value="Fee">Fee</option>
                                        <option value="Discount">Discount</option>
                                        <option value="Service">Service</option>
                                    </select>
                                </div>
                            </div>

                            {/* Right-aligned controls */}
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold cursor-pointer pb-2"> 
                                    <input 
                                        type="checkbox" 
                                        checked={item.isWarrantyWork || false}
                                        onChange={e => handleUpdateItem(item.id, 'isWarrantyWork', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                    />
                                    <span className="text-amber-600 dark:text-amber-500">Warranty</span>
                                </label>
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
                                    {item.unitPrice < 0 ? '-' : ''}${(item.quantity * Math.abs(item.unitPrice)).toFixed(2)}
                                </p>
                            </div>
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
