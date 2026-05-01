import React, { useState } from 'react';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import Textarea from 'components/ui/Textarea';
import { BidLineItem, ProposalPreset } from 'types';
import { Trash2, Plus, Sparkles } from 'lucide-react';
import Modal from 'components/ui/Modal';

interface PricingTabProps {
    lineItems: BidLineItem[];
    onUpdate: (id: string, field: keyof BidLineItem, value: any) => void;
    onDelete: (id: string) => void;
    onAdd: (item: Partial<BidLineItem>) => void;
    pricebook: ProposalPreset[];
    onAddFromPricebook: (preset: ProposalPreset) => void;
    onGenerateAIPricing: () => void;
    isGeneratingAIPricing: boolean;
}

const PricingTab: React.FC<PricingTabProps> = ({ lineItems, onUpdate, onDelete, onAdd, pricebook, onAddFromPricebook, onGenerateAIPricing, isGeneratingAIPricing }) => {
    const [isPricebookOpen, setIsPricebookOpen] = useState(false);
    const [newItem, setNewItem] = useState<Partial<BidLineItem>>({ qty: 1, unit: 'EA', unitPrice: 0 });
    const total = lineItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0);

    return (
        <div className="space-y-6">
            <Modal isOpen={isPricebookOpen} onClose={() => setIsPricebookOpen(false)} title="Select from Pricebook">
                <div className="h-[60vh] flex flex-col">
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {pricebook.map(p => (
                            <div key={p.id} onClick={() => { onAddFromPricebook(p); setIsPricebookOpen(false); }} className="p-3 border rounded hover:bg-slate-50 cursor-pointer flex justify-between items-center group transition-colors">
                                <div>
                                    <p className="font-bold text-sm text-slate-800">{p.name}</p>
                                    <p className="text-xs text-slate-500 line-clamp-1">{p.description}</p>
                                </div>
                                <div className="text-sm font-semibold text-slate-700 bg-white px-2 py-1 border rounded group-hover:border-primary-500 group-hover:text-primary-600 transition-colors">
                                    ${p.baseCost?.toFixed(2)}
                                </div>
                            </div>
                        ))}
                        {pricebook.length === 0 && (
                            <div className="text-center p-4 md:p-8 text-slate-500 italic">No items found in your pricebook.</div>
                        )}
                    </div>
                </div>
            </Modal>

            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Pricing Schedule (CLINs)</h3>
                <div className="flex gap-2">
                    <Button onClick={onGenerateAIPricing} disabled={isGeneratingAIPricing || lineItems.length === 0} variant="secondary" className="text-xs flex items-center gap-1 border-purple-200 text-purple-700 hover:bg-purple-50">
                        {isGeneratingAIPricing ? <span className="animate-pulse">Analyzing...</span> : <><Sparkles size={14} className="text-purple-500" /> AI Pricing Recommendations</>}
                    </Button>
                    <Button onClick={() => setIsPricebookOpen(true)} variant="secondary" className="text-xs flex items-center gap-1">
                        <Plus size={14} /> Add from Pricebook
                    </Button>
                </div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner overflow-x-auto">
                <div className="min-w-[900px]">
                    {/* Header Row */}
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <div className="flex-[3_3_0%] min-w-[250px]">Description</div>
                        <div className="flex-[0.5_0.5_0%] min-w-[80px] text-center">Unit</div>
                        <div className="flex-[0.5_0.5_0%] min-w-[80px] text-center">Qty</div>
                        <div className="flex-[1_1_0%] min-w-[120px] text-right">Unit Price</div>
                        <div className="flex-[1_1_0%] min-w-[120px] text-right text-purple-600">AI Rec Price</div>
                        <div className="flex-[1_1_0%] min-w-[120px] text-right">Total</div>
                        <div className="w-[40px] flex-shrink-0"></div>
                    </div>

                    {/* Line Items */}
                    <div className="p-2 space-y-2">
                        {lineItems.length === 0 && (
                            <div className="text-center p-4 md:p-8 text-slate-400 text-sm italic bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                                No line items added yet. Click above or add manually below.
                            </div>
                        )}
                        {lineItems.map((item) => (
                            <div key={item.id} className="flex items-start gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:border-primary-300 transition-colors group">
                                <div className="flex-[3_3_0%] min-w-[250px]">
                                    <textarea 
                                        className="w-full text-sm bg-transparent border-transparent hover:border-slate-300 focus:border-primary-500 focus:bg-white transition-all shadow-none rounded-md p-2 resize-none overflow-hidden h-auto min-h-[38px]" 
                                        value={item.description || ''} 
                                        onChange={(e) => {
                                            onUpdate(item.id, 'description', e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }} 
                                        placeholder="Item description"
                                        rows={1}
                                        onFocus={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                    />
                                </div>
                                <div className="flex-[0.5_0.5_0%] min-w-[80px] pt-1">
                                    <Input 
                                        className="w-full text-sm text-center bg-transparent border-transparent hover:border-slate-300 focus:border-primary-500 focus:bg-white transition-all shadow-none" 
                                        value={item.unit || ''} 
                                        onChange={(e) => onUpdate(item.id, 'unit', e.target.value)} 
                                        placeholder="EA"
                                    />
                                </div>
                                <div className="flex-[0.5_0.5_0%] min-w-[80px] pt-1">
                                    <Input 
                                        className="w-full text-sm text-center bg-transparent border-transparent hover:border-slate-300 focus:border-primary-500 focus:bg-white transition-all shadow-none" 
                                        type="number" 
                                        value={item.qty || 0} 
                                        onChange={(e) => onUpdate(item.id, 'qty', parseFloat(e.target.value) || 0)} 
                                    />
                                </div>
                                <div className="flex-[1_1_0%] min-w-[120px] pt-1">
                                    <Input 
                                        className="w-full text-sm text-right bg-transparent border-transparent hover:border-slate-300 focus:border-primary-500 focus:bg-white transition-all shadow-none" 
                                        type="number" 
                                        value={item.unitPrice || 0} 
                                        onChange={(e) => onUpdate(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} 
                                        prefix="$"
                                    />
                                </div>
                                <div className="flex-[1_1_0%] min-w-[120px] pt-1 flex items-center justify-end">
                                    {item.aiRecommendedPrice !== undefined ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-100">
                                                ${item.aiRecommendedPrice.toFixed(2)}
                                            </span>
                                            <button 
                                                onClick={() => onUpdate(item.id, 'unitPrice', item.aiRecommendedPrice)}
                                                className="text-purple-600 hover:text-purple-800 hover:bg-purple-100 p-1 rounded"
                                                title="Apply Recommendation"
                                            >
                                                <Sparkles size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 text-xs italic">N/A</span>
                                    )}
                                </div>
                                <div className="flex-[1_1_0%] min-w-[120px] text-right font-bold text-slate-800 dark:text-white px-3 pt-3">
                                    ${(item.totalPrice || 0).toFixed(2)}
                                </div>
                                <div className="w-[40px] flex-shrink-0 flex justify-center pt-2">
                                    <button 
                                        onClick={() => onDelete(item.id)} 
                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Remove item"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add New Item Row */}
                    <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 mt-2 rounded-b-xl">
                        <div className="flex items-start gap-2">
                            <div className="flex-[3_3_0%] min-w-[250px]">
                                <textarea 
                                    className="w-full text-sm rounded-md border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 p-2 resize-none overflow-hidden h-auto min-h-[38px]" 
                                    placeholder="Enter new item description..." 
                                    value={newItem.description || ''} 
                                    onChange={(e) => {
                                        setNewItem({...newItem, description: e.target.value});
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }} 
                                    rows={1}
                                />
                            </div>
                            <div className="flex-[0.5_0.5_0%] min-w-[80px]">
                                <Input 
                                    className="w-full text-sm text-center" 
                                    placeholder="Unit" 
                                    value={newItem.unit || ''} 
                                    onChange={e => setNewItem({...newItem, unit: e.target.value})} 
                                />
                            </div>
                            <div className="flex-[0.5_0.5_0%] min-w-[80px]">
                                <Input 
                                    className="w-full text-sm text-center" 
                                    type="number" 
                                    placeholder="Qty"
                                    value={newItem.qty || ''} 
                                    onChange={e => setNewItem({...newItem, qty: parseFloat(e.target.value) || 0})} 
                                />
                            </div>
                            <div className="flex-[1_1_0%] min-w-[120px]">
                                <Input 
                                    className="w-full text-sm text-right" 
                                    type="number" 
                                    placeholder="Price" 
                                    value={newItem.unitPrice || ''} 
                                    onChange={e => setNewItem({...newItem, unitPrice: parseFloat(e.target.value) || 0})} 
                                    prefix="$"
                                />
                            </div>
                            <div className="flex-[1_1_0%] min-w-[120px]"></div>
                            <div className="flex-[1_1_0%] min-w-[120px] pr-[48px] flex justify-end">
                                <Button 
                                    onClick={() => {
                                        if (newItem.description) {
                                            onAdd(newItem);
                                            setNewItem({ description: '', qty: 1, unit: 'EA', unitPrice: 0 });
                                        }
                                    }}
                                    disabled={!newItem.description}
                                    size="sm"
                                    className="whitespace-nowrap px-4"
                                >
                                    Add Item
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Total Row */}
            <div className="flex justify-end items-end flex-col mt-4">
                <div className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-1">Total Estimated Value</div>
                <div className="text-3xl font-black text-primary-700 bg-primary-50 px-6 py-2 rounded-xl border border-primary-200">
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            </div>
        </div>
    );
};

export default PricingTab;
