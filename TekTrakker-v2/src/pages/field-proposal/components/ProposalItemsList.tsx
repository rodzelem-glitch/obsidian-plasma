
import React from 'react';
import { Trash2 as TrashIcon, ChevronUp, ChevronDown, PlusCircle } from 'lucide-react';
import { useLanguage } from 'context/LanguageContext';
import { matchTier } from 'lib/utils';
import type { SubLineItem } from 'types';
import AutoResizeTextarea from 'components/ui/AutoResizeTextarea';
import { NumberInput } from 'components/ui/Input';

// This is the internal representation used in FieldProposal
type InternalProposalItem = {
    id: string;
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type: 'Part' | 'Labor' | 'Part/Labor' | 'Service' | 'Fee' | 'Discount';
    tier: 'Basic' | 'Premium' | 'Platinum';
    taxable?: boolean;
    isPercentage?: boolean;
    cost?: number;
    vendorCost?: number;
    markupPct?: number;
    partCost?: number;
    margin?: number;
    subItems?: SubLineItem[];
};

type Tier = 'Basic' | 'Premium' | 'Platinum';

interface ProposalItemsListProps {
    items: InternalProposalItem[];
    activeTier: Tier;
    onUpdate: (id: string, field: keyof InternalProposalItem, value: any) => void;
    onDelete: (id: string) => void;
    onMoveItem?: (id: string, direction: 'up' | 'down') => void;
    onAddSubItem?: (itemId: string) => void;
    onUpdateSubItem?: (itemId: string, subItemId: string, field: keyof SubLineItem, value: any) => void;
    onDeleteSubItem?: (itemId: string, subItemId: string) => void;
}

const ProposalItemsList: React.FC<ProposalItemsListProps> = ({ items, activeTier, onUpdate, onDelete, onMoveItem, onAddSubItem, onUpdateSubItem, onDeleteSubItem }) => {
    const tierItems = items.filter(i => matchTier(i.tier, activeTier));
    const { t } = useLanguage();

    return (
        <div className="space-y-4 min-h-[100px] w-full max-w-full overflow-hidden">
            <div className="flex justify-between items-end border-b-2 border-slate-200 dark:border-slate-700 pb-2">
                <h4 className="font-black text-xs uppercase text-slate-500 dark:text-slate-400">{t("Items in")} {t(activeTier)} {t("Option")}</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">{tierItems.length} {tierItems.length === 1 ? t("item") : t("items")}</span>
            </div>
            
            {tierItems.length === 0 && (
                <p className="text-sm text-slate-400 italic text-center py-4 md:py-8">{t("No items added to this option yet.")}</p>
            )}
            
            {tierItems.map((item, index) => (
                <div key={item.id} className="flex flex-col gap-3 p-3.5 sm:p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm group hover:border-primary-300 transition-colors w-full min-w-0 max-w-full overflow-hidden">
                    {/* Header Row: Reorder, Name Input, Item Type Select, Delete Button */}
                    <div className="flex items-center gap-2 w-full min-w-0 max-w-full">
                        {onMoveItem && (
                            <div className="flex flex-row gap-0.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => onMoveItem(item.id, 'up')}
                                    disabled={index === 0}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                    title={t("Move up")}
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onMoveItem(item.id, 'down')}
                                    disabled={index === tierItems.length - 1}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                    title={t("Move down")}
                                >
                                    <ChevronDown size={16} />
                                </button>
                            </div>
                        )}
                        <input 
                            className="flex-1 min-w-0 font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary-500 placeholder-slate-400 text-sm"
                            value={item.name}
                            onChange={e => onUpdate(item.id, 'name', e.target.value)}
                            placeholder={t("Item Name")}
                        />
                        <select
                            value={item.type}
                            onChange={e => onUpdate(item.id, 'type', e.target.value)}
                            className="text-[10px] bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 outline-none px-2 py-1.5 rounded text-slate-600 dark:text-slate-300 uppercase font-bold tracking-wider cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0"
                            aria-label={t("Item Type")}
                            title={t("Item Type")}
                        >
                            <option value="Labor">{t("Labor")}</option>
                            <option value="Part">{t("Part")}</option>
                            <option value="Part/Labor">{t("Part/Labor")}</option>
                            <option value="Fee">{t("Fee")}</option>
                            <option value="Service">{t("Service")}</option>
                            <option value="Discount">{t("Discount")}</option>
                        </select>
                        <button 
                            type="button"
                            aria-label={t("Delete Item")} 
                            title={t("Delete Item")} 
                            onClick={() => onDelete(item.id)} 
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors p-1.5 rounded-lg shrink-0 cursor-pointer"
                        >
                            <TrashIcon size={18}/>
                        </button>
                    </div>

                    {/* Middle Section: Description Textarea & Sub-Items */}
                    <div className="w-full min-w-0 space-y-2">
                        <AutoResizeTextarea 
                            className="w-full min-w-0 font-medium text-xs text-slate-700 dark:text-slate-300 bg-slate-50/30 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary-500 placeholder-slate-400"
                            value={item.description || ''}
                            onChange={e => onUpdate(item.id, 'description', e.target.value)}
                            placeholder={t("Description...")}
                            minHeight={42}
                        />

                        {/* Sub-line items section */}
                        {item.subItems && item.subItems.length > 0 && (
                            <div className="mt-2 pl-3 border-l-2 border-primary-400 dark:border-primary-600 space-y-2 max-w-full overflow-hidden">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                    {t("Sub-Line Items")}
                                </span>
                                {item.subItems.map((sub) => (
                                    <div key={sub.id} className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-md border border-slate-200 dark:border-slate-700 text-xs min-w-0 max-w-full">
                                        <AutoResizeTextarea
                                            value={sub.description || ''}
                                            onChange={e => onUpdateSubItem?.(item.id, sub.id, 'description', e.target.value)}
                                            placeholder={t("Sub-item description...")}
                                            className="flex-1 min-w-[120px] max-w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-primary-500 rounded p-1.5 font-medium text-slate-800 dark:text-slate-200 text-xs"
                                            minHeight={32}
                                        />
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-slate-400 font-semibold text-[10px]">{t("Qty:")}</span>
                                            <NumberInput
                                                value={sub.quantity ?? 1}
                                                onChange={e => onUpdateSubItem?.(item.id, sub.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="w-14 text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 font-medium text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-slate-400 font-semibold text-[10px]">{t("Price ($):")}</span>
                                            <NumberInput
                                                value={sub.unitPrice ?? 0}
                                                onChange={e => onUpdateSubItem?.(item.id, sub.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                step="0.01"
                                                className="w-20 text-right bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1 font-medium text-slate-800 dark:text-slate-200"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteSubItem?.(item.id, sub.id)}
                                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors ml-auto cursor-pointer shrink-0"
                                            title={t("Remove sub-item")}
                                        >
                                            <TrashIcon size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-1 flex justify-start">
                            <button
                                type="button"
                                onClick={() => {
                                    if (onAddSubItem) {
                                        onAddSubItem(item.id);
                                    } else {
                                        const newSub: SubLineItem = {
                                            id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                                            description: '',
                                            quantity: 1,
                                            unitPrice: 0,
                                            total: 0
                                        };
                                        const existing = item.subItems || [];
                                        onUpdate(item.id, 'subItems' as any, [...existing, newSub]);
                                    }
                                }}
                                className="text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 hover:bg-primary-100 dark:hover:bg-primary-900 border border-primary-200 dark:border-primary-800 rounded-md px-2.5 py-1 flex items-center gap-1.5 transition-colors cursor-pointer w-fit shadow-sm"
                            >
                                <PlusCircle size={14} className="text-primary-600 dark:text-primary-400" /> + {t("Add Sub-item")}
                            </button>
                        </div>
                    </div>

                    {/* Bottom Pricing & Quantity Bar */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 sm:p-3 rounded-lg border border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 w-full min-w-0 max-w-full">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
                            <div className="flex flex-col w-16 shrink-0">
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">{t("Qty")}</label>
                                <NumberInput 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center font-bold text-sm p-1 text-slate-900 dark:text-white"
                                    value={item.quantity}
                                    aria-label={t("Item Quantity")}
                                    title={t("Item Quantity")}
                                    onChange={e => onUpdate(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            {/* Cost ($) Input (Editor Mode Only - hidden for percentage fee/discount) */}
                            {(!item.isPercentage && item.type !== 'Fee' && item.type !== 'Discount') && (
                                <div className="flex flex-col w-20 sm:w-24 shrink-0">
                                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5 truncate" title={t("Our internal cost before markup")}>
                                        {t("Cost ($)")}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold pointer-events-none">$</span>
                                        <NumberInput 
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-right font-bold text-sm pl-4 pr-1.5 py-1 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary-500"
                                            value={item.cost ?? item.vendorCost ?? item.partCost ?? 0}
                                            min="0"
                                            step="0.01"
                                            aria-label={t("Cost ($)")}
                                            title={t("Our Cost ($)")}
                                            onChange={e => onUpdate(item.id, 'cost', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Markup % Input (Editor Mode Only - hidden for percentage fee/discount) */}
                            {(!item.isPercentage && item.type !== 'Fee' && item.type !== 'Discount') && (
                                <div className="flex flex-col w-16 sm:w-20 shrink-0">
                                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5 truncate" title={t("Markup percentage applied over cost")}>
                                        {t("Markup %")}
                                    </label>
                                    <div className="relative">
                                        <NumberInput 
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-right font-bold text-sm pl-1.5 pr-4 py-1 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary-500"
                                            value={item.markupPct ?? item.margin ?? 0}
                                            min="0"
                                            step="0.1"
                                            aria-label={t("Markup %")}
                                            title={t("Markup %")}
                                            onChange={e => onUpdate(item.id, 'markupPct', parseFloat(e.target.value) || 0)}
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold pointer-events-none">%</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col w-24 sm:w-28 shrink-0">
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 truncate">{item.isPercentage ? t('Percent (%)') : t('Unit Price')}</label>
                                <NumberInput 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-right font-bold text-sm p-1 text-slate-900 dark:text-white"
                                    value={
                                        item.type === 'Discount'
                                            ? (item.isPercentage ? (item.unitPrice ?? 0) : Math.abs(item.unitPrice ?? 0))
                                            : (item.unitPrice ?? 0)
                                    }
                                    aria-label={item.isPercentage ? t('Percent (%)') : t('Unit Price')}
                                    title={item.isPercentage ? t('Percent (%)') : t('Unit Price')}
                                    step="0.01"
                                    onChange={e => onUpdate(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            
                            {(item.type === 'Fee' || item.type === 'Discount') ? (
                                <div className="flex flex-col items-center px-1 shrink-0">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">{t("%")}</label>
                                    <input 
                                        type="checkbox" 
                                        checked={!!item.isPercentage} 
                                        aria-label={t("Is Percentage")}
                                        title={t("Is Percentage")}
                                        onChange={e => onUpdate(item.id, 'isPercentage', e.target.checked)}
                                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                </div>
                            ) : null}

                            <div className="flex flex-col items-center px-1 shrink-0">
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">{t("Tax")}</label>
                                <input 
                                    type="checkbox" 
                                    checked={item.taxable !== false} 
                                    aria-label={t("Is Taxable")}
                                    title={t("Is Taxable")}
                                    onChange={e => onUpdate(item.id, 'taxable', e.target.checked)}
                                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                            </div>

                            {/* Profit Margin Pill for items with Cost > 0 */}
                            {(() => {
                                const rawCost = Number(item.cost ?? item.vendorCost ?? item.partCost ?? 0);
                                if (rawCost <= 0 || item.isPercentage || item.type === 'Fee' || item.type === 'Discount') return null;
                                const unitPrice = Number(item.unitPrice || 0);
                                const qty = Number(item.quantity || 1);
                                const profit = (unitPrice - rawCost) * qty;
                                const marginPct = unitPrice > 0 ? ((unitPrice - rawCost) / unitPrice) * 100 : 0;
                                return (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-md text-[10px] text-emerald-800 dark:text-emerald-300 font-bold tracking-tight shrink-0 self-end mb-0.5">
                                        <span>{t("Profit:")} <strong className="font-black">${profit.toFixed(2)}</strong></span>
                                        <span className="text-emerald-600 dark:text-emerald-400">({marginPct.toFixed(0)}% margin)</span>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="text-right shrink-0 ml-auto">
                            <label className="text-[9px] font-bold text-slate-400 uppercase block">{t("Total")}</label>
                            <span className="font-black text-base sm:text-lg block truncate text-slate-900 dark:text-white">${(item.total || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProposalItemsList;
