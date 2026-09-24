
import React from 'react';
import { Trash2, PlusCircle, Tag, ChevronUp, ChevronDown, ShieldCheck } from 'lucide-react';
import Button from '../../ui/Button';
import AutoResizeTextarea from '../../ui/AutoResizeTextarea';
import { NumberInput } from '../../ui/Input';
import type { InvoiceLineItem, SubLineItem, CustomerMarkupRule } from '../../../types';
import { getItemTotal, getItemUnitPrice } from './useInvoiceLogic';
import { calculateCustomerPartMarkup } from '../../../lib/estimatorRules';


interface LineItemsListProps {
    lineItems: InvoiceLineItem[];
    handleUpdateItem: (id: string, field: keyof InvoiceLineItem, value: any) => void;
    handleDeleteItem: (id: string) => void;
    handleAddItem: (type?: InvoiceLineItem['type'], description?: string, unitPrice?: number, taxable?: boolean) => void;
    setIsDiscountModalOpen: (open: boolean) => void;
    onOpenWarrantyModal?: () => void;
    contractedRate?: number;
    overtimeRate?: number;
    emergencyContractedRate?: number;
    tripCharge?: number;
    emergencyTripCharge?: number;
    partsMarkupPercentage?: number;
    partsMarkupRules?: CustomerMarkupRule[];
    partsMarkupTier1?: number;
    partsMarkupTier2?: number;
    handleMoveItem?: (id: string, direction: 'up' | 'down') => void;
    handleAddSubItem?: (lineItemId: string) => void;
    handleUpdateSubItem?: (lineItemId: string, subItemId: string, field: keyof SubLineItem, value: any) => void;
    handleDeleteSubItem?: (lineItemId: string, subItemId: string) => void;
}

const LineItemsList: React.FC<LineItemsListProps> = ({
    lineItems,
    handleUpdateItem,
    handleDeleteItem,
    handleAddItem,
    setIsDiscountModalOpen,
    onOpenWarrantyModal,
    contractedRate,
    overtimeRate,
    emergencyContractedRate,
    tripCharge,
    emergencyTripCharge,
    partsMarkupPercentage,
    partsMarkupRules,
    partsMarkupTier1,
    partsMarkupTier2,
    handleMoveItem,
    handleAddSubItem,
    handleUpdateSubItem,
    handleDeleteSubItem
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
                                <AutoResizeTextarea 
                                    className="w-full font-medium text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 rounded-md p-2.5 text-slate-600 dark:text-slate-300 shadow-inner"
                                    value={item.description || ''}
                                    onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                    placeholder="Detailed description..."
                                    minHeight={42}
                                />

                                {/* Sub-line items section */}
                                {item.subItems && item.subItems.length > 0 && (
                                    <div className="mt-2 pl-3 border-l-2 border-primary-400 dark:border-primary-600 space-y-2">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                            Sub-Line Items
                                        </span>
                                        {item.subItems.map((sub) => (
                                            <div key={sub.id} className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-md border border-slate-200 dark:border-slate-700 text-xs">
                                                <AutoResizeTextarea
                                                    value={sub.description || ''}
                                                    onChange={e => handleUpdateSubItem?.(item.id, sub.id, 'description', e.target.value)}
                                                    placeholder="Sub-item description..."
                                                    className="flex-1 min-w-[140px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-primary-500 rounded p-1.5 font-medium text-slate-800 dark:text-slate-200 text-xs"
                                                    minHeight={32}
                                                />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-slate-400 font-semibold text-[10px]">Qty:</span>
                                                    <NumberInput
                                                        value={sub.quantity ?? 1}
                                                        onChange={e => handleUpdateSubItem?.(item.id, sub.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                        className="w-14 text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 font-medium text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-slate-400 font-semibold text-[10px]">Price ($):</span>
                                                    <NumberInput
                                                        value={sub.unitPrice ?? 0}
                                                        onChange={e => handleUpdateSubItem?.(item.id, sub.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                        step="0.01"
                                                        className="w-20 text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 font-medium text-slate-800 dark:text-slate-200"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSubItem?.(item.id, sub.id)}
                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors ml-auto"
                                                    title="Remove sub-item"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-2 flex justify-start">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (handleAddSubItem) {
                                                handleAddSubItem(item.id);
                                            } else {
                                                const newSub: SubLineItem = {
                                                    id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                                                    description: '',
                                                    quantity: 1,
                                                    unitPrice: 0,
                                                    total: 0
                                                };
                                                const existing = item.subItems || [];
                                                handleUpdateItem(item.id, 'subItems' as any, [...existing, newSub]);
                                            }
                                        }}
                                        className="text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 hover:bg-primary-100 dark:hover:bg-primary-900 border border-primary-200 dark:border-primary-800 rounded-md px-2.5 py-1 flex items-center gap-1.5 transition-colors cursor-pointer w-fit shadow-sm"
                                    >
                                        <PlusCircle size={14} className="text-primary-600 dark:text-primary-400" /> + Add Sub-item
                                    </button>
                                </div>
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
                                    <NumberInput 
                                        id={`qty-${item.id}`}
                                        value={item.quantity ?? 1}
                                        onChange={e => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
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
                                {(!item.isPercentage && item.type !== 'Fee' && item.type !== 'Discount') && (
                                    <>
                                        <div className="flex flex-col gap-1 w-20 sm:w-24">
                                            <label htmlFor={`cost-${item.id}`} className="font-semibold px-1 text-slate-500 dark:text-slate-400" title="Our internal cost before markup">
                                                Cost ($)
                                            </label>
                                            <NumberInput 
                                                id={`cost-${item.id}`}
                                                value={item.cost ?? item.vendorCost ?? 0}
                                                onChange={e => handleUpdateItem(item.id, 'vendorCost' as any, parseFloat(e.target.value) || 0)}
                                                step="0.01"
                                                min="0"
                                                className="h-10 pl-3 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded focus:ring-1 focus:ring-primary-500 font-medium"
                                                aria-label="Cost"
                                                title="Internal Cost"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 w-16 sm:w-20">
                                            <label htmlFor={`markup-${item.id}`} className="font-semibold px-1 text-slate-500 dark:text-slate-400" title="Markup percentage">
                                                Markup %
                                            </label>
                                            <NumberInput 
                                                id={`markup-${item.id}`}
                                                value={item.markupPct ?? 0}
                                                onChange={e => handleUpdateItem(item.id, 'markupPct' as any, parseFloat(e.target.value) || 0)}
                                                step="1"
                                                className="h-10 text-center bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded focus:ring-1 focus:ring-primary-500 font-medium"
                                                aria-label="Markup %"
                                                title="Markup %"
                                            />
                                        </div>
                                    </>
                                )}
                                <div className="flex flex-col gap-1 w-24 sm:w-28">
                                    <label htmlFor={`price-${item.id}`} className="font-semibold px-1">
                                        {item.type === 'Discount' ? (item.isPercentage ? 'Discount (%)' : 'Discount ($)') : 'Price ($)'}
                                    </label>
                                    <NumberInput 
                                        id={`price-${item.id}`}
                                        value={
                                            item.type === 'Discount' 
                                                ? (item.isPercentage ? (item.percentageRate ?? 0) : Math.abs(item.unitPrice ?? 0))
                                                : (item.unitPrice ?? 0)
                                        }
                                        onChange={e => {
                                            const val = parseFloat(e.target.value) || 0;
                                            if (item.type === 'Discount' && item.isPercentage) {
                                                handleUpdateItem(item.id, 'percentageRate', val);
                                            } else {
                                                handleUpdateItem(item.id, 'unitPrice', val);
                                            }
                                        }}
                                        step="0.01"
                                        className="h-10 pl-3 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 border rounded focus:ring-1 focus:ring-primary-500 font-medium"
                                        aria-label="Unit Price"
                                        title="Unit Price"
                                    />
                                    {(() => {
                                        const rawCost = Number(item.cost ?? item.vendorCost ?? 0);
                                        const unitPrice = getItemUnitPrice(item) || 0;
                                        if (rawCost > 0 && unitPrice > 0 && item.type !== 'Discount' && item.type !== 'Fee') {
                                            const profit = unitPrice - rawCost;
                                            const marginPct = (profit / unitPrice) * 100;
                                            return (
                                                <div className="mt-1">
                                                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${profit >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>
                                                        {profit >= 0 ? '+' : ''}${profit.toFixed(2)} ({marginPct.toFixed(0)}%)
                                                    </span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    {(item.type === 'Labor' || item.type === 'Part/Labor' || item.type === 'Part') && (
                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                            {contractedRate !== undefined && contractedRate > 0 && (item.type === 'Labor' || item.type === 'Part/Labor') && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateItem(item.id, 'unitPrice', contractedRate)}
                                                    className="text-[9px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-500 font-extrabold underline leading-tight text-left"
                                                    title="Apply standard contracted rate"
                                                >
                                                    Apply Contracted (${contractedRate.toFixed(2)})
                                                </button>
                                            )}
                                            {overtimeRate !== undefined && overtimeRate > 0 && (item.type === 'Labor' || item.type === 'Part/Labor') && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateItem(item.id, 'unitPrice', overtimeRate)}
                                                    className="text-[9px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 font-extrabold underline leading-tight text-left"
                                                    title="Apply overtime labor rate"
                                                >
                                                    Apply Overtime (${overtimeRate.toFixed(2)})
                                                </button>
                                            )}
                                            {emergencyContractedRate !== undefined && emergencyContractedRate > 0 && (item.type === 'Labor' || item.type === 'Part/Labor') && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateItem(item.id, 'unitPrice', emergencyContractedRate)}
                                                    className="text-[9px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-500 font-extrabold underline leading-tight text-left"
                                                    title="Apply emergency hours contract rate"
                                                >
                                                    Apply Emergency (${emergencyContractedRate.toFixed(2)})
                                                </button>
                                            )}
                                            {(() => {
                                                const hasMarkup = (partsMarkupRules && partsMarkupRules.length > 0) || (partsMarkupTier1 !== undefined) || (partsMarkupPercentage !== undefined && partsMarkupPercentage > 0);
                                                if (!hasMarkup || (item.type !== 'Part' && item.type !== 'Part/Labor')) return null;

                                                const currentVal = getItemUnitPrice(item) || 0;
                                                const activeRate = calculateCustomerPartMarkup(
                                                    currentVal,
                                                    partsMarkupRules,
                                                    partsMarkupPercentage,
                                                    { tier1: partsMarkupTier1, tier2: partsMarkupTier2 }
                                                );

                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const markedUp = currentVal * (1 + activeRate / 100);
                                                            handleUpdateItem(item.id, 'unitPrice', parseFloat(markedUp.toFixed(2)));
                                                        }}
                                                        className="text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-500 font-extrabold underline leading-tight text-left"
                                                        title={`Apply customer parts markup (+${activeRate}%)`}
                                                    >
                                                        Apply Parts Markup (+{activeRate}%)
                                                    </button>
                                                );
                                            })()}
                                        </div>
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
                                    {getItemTotal(item) < 0 ? '-' : ''}${Math.abs(getItemTotal(item)).toFixed(2)}
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
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-xl flex gap-3 flex-wrap sm:flex-nowrap">
                <Button onClick={() => handleAddItem()} variant="secondary" className="flex-1 font-bold">
                    <PlusCircle size={16} className="mr-2"/> Add Line Item
                </Button>
                {onOpenWarrantyModal && (
                    <Button 
                        type="button"
                        onClick={onOpenWarrantyModal} 
                        variant="secondary" 
                        className="font-bold px-4 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border-emerald-300 dark:border-emerald-800"
                    >
                        <ShieldCheck size={16} className="mr-2 text-emerald-600"/> Add Extended Warranty
                    </Button>
                )}
                {tripCharge !== undefined && tripCharge > 0 && (
                    <Button onClick={() => handleAddItem('Fee', 'Standard Trip Charge', tripCharge)} variant="secondary" className="font-bold px-4 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/30">
                        <PlusCircle size={16} className="mr-2"/> Add Trip Charge (${tripCharge.toFixed(2)})
                    </Button>
                )}
                {emergencyTripCharge !== undefined && emergencyTripCharge > 0 && (
                    <Button onClick={() => handleAddItem('Fee', 'Emergency Trip Charge', emergencyTripCharge)} variant="secondary" className="font-bold px-4 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30">
                        <PlusCircle size={16} className="mr-2"/> Add Emergency Trip (${emergencyTripCharge.toFixed(2)})
                    </Button>
                )}
                <Button onClick={() => setIsDiscountModalOpen(true)} variant="secondary" className="font-bold px-6">
                    <Tag size={16} className="mr-2"/> Discount
                </Button>
            </div>
        </div>
    );
};

export default LineItemsList;
