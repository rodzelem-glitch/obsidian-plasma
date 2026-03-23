
import React from 'react';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import { ProposalPreset } from 'types';

interface PricebookModalProps {
    isOpen: boolean;
    onClose: () => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    presets: ProposalPreset[];
    onSelect: (preset: ProposalPreset) => void;
    marketMultiplier: number;
}

const PricebookModal: React.FC<PricebookModalProps> = ({ 
    isOpen, onClose, searchQuery, onSearchChange, presets, onSelect, marketMultiplier 
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add from Pricebook">
            <div className="h-[60vh] flex flex-col">
                <Input 
                    placeholder="Search items..." 
                    value={searchQuery} 
                    onChange={e => onSearchChange(e.target.value)} 
                    className="mb-4"
                    autoFocus
                />
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                    {presets.map(p => (
                        <div key={p.id} onClick={() => onSelect(p)} className="p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors">
                            <div>
                                <p className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</p>
                                <p className="text-xs text-slate-500 line-clamp-1">{p.description}</p>
                            </div>
                            <span className="font-black text-green-600 bg-green-50 px-2 py-1 rounded text-xs">
                                ${(((p.baseCost * 2) + (p.avgLabor * 120)) * marketMultiplier).toFixed(0)}
                            </span>
                        </div>
                    ))}
                    {presets.length === 0 && <p className="text-center text-slate-400 py-4 md:py-8 text-sm">No items found.</p>}
                </div>
            </div>
        </Modal>
    );
};

export default PricebookModal;
