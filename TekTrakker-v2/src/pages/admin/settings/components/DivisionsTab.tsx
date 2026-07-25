import React, { useState } from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';
import { Layers, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Division, IndustryVertical } from 'types';
import showToast from 'lib/toast';

interface DivisionsTabProps {
    divisions: Division[];
    setDivisions: (val: Division[]) => void;
    supportedTrades: IndustryVertical[];
    additionalDivisionsSlots?: number;
}

export const DivisionsTab: React.FC<DivisionsTabProps> = ({
    divisions = [],
    setDivisions,
    supportedTrades = [],
    additionalDivisionsSlots = 0
}) => {
    const [newName, setNewName] = useState('');
    const [newTrade, setNewTrade] = useState<IndustryVertical | ''>('');

    const allowedCount = 1 + additionalDivisionsSlots;
    const isLimitReached = divisions.length >= allowedCount;

    const handleAddDivision = () => {
        if (!newName.trim()) {
            showToast.warn("Please enter a division name.");
            return;
        }
        if (!newTrade) {
            showToast.warn("Please select an industry trade for this division.");
            return;
        }
        if (isLimitReached) {
            showToast.error(`You have reached your limit of ${allowedCount} division(s). Please purchase more division slots in your Plan & Billing settings.`);
            return;
        }

        const id = `div-${Date.now()}`;
        const newDiv: Division = {
            id,
            name: newName.trim(),
            trade: newTrade,
            createdAt: new Date().toISOString()
        };

        setDivisions([...divisions, newDiv]);
        setNewName('');
        setNewTrade('');
        showToast.success("Division added. Click 'Commit All Settings' to save.");
    };

    const handleRemoveDivision = (id: string) => {
        setDivisions(divisions.filter(d => d.id !== id));
        showToast.success("Division removed. Click 'Commit All Settings' to save.");
    };

    return (
        <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-700/50 pb-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-primary-500">
                        <Layers size={20}/> Organization Divisions
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        Organize your company into distinct trades or departments, assigning users to their respective divisions.
                    </p>
                </div>
                <div className="mt-4 md:mt-0 flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
                    <span className="text-xs text-slate-400 uppercase font-black tracking-wider">Slots Utilized:</span>
                    <span className={`text-sm font-black ${isLimitReached ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {divisions.length} / {allowedCount}
                    </span>
                </div>
            </div>

            {/* Warn if limit reached */}
            {isLimitReached && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex gap-3 items-start">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <div>
                        <p className="text-xs font-bold text-amber-200">Division Slot Limit Reached</p>
                        <p className="text-[10px] text-amber-400/90 mt-0.5 leading-relaxed">
                            To create more divisions, please upgrade your subscription or purchase additional slots. 
                            Contact your platform administrator or check the <strong>Plan & Billing</strong> tab.
                        </p>
                    </div>
                </div>
            )}

            {/* Add division form */}
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/40 mb-6">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">Add New Division</h4>
                {supportedTrades.length === 0 ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                        No supported trades configured. Please select your trades in the <strong>Identity</strong> tab first before adding divisions.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <Input 
                            id="div-new-name" 
                            label="Division Name" 
                            placeholder="e.g. Plumbing Service, HVAC Residential" 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)} 
                            disabled={isLimitReached}
                        />
                        <Select 
                            id="div-new-trade" 
                            label="Associated Trade" 
                            value={newTrade} 
                            onChange={e => setNewTrade(e.target.value as IndustryVertical)}
                            disabled={isLimitReached}
                        >
                            <option value="">-- Select Trade --</option>
                            {supportedTrades.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </Select>
                        <Button 
                            onClick={handleAddDivision} 
                            disabled={isLimitReached}
                            className="bg-primary-500 hover:bg-primary-600 text-white w-full h-[42px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                        >
                            <Plus size={14} /> Add Division
                        </Button>
                    </div>
                )}
            </div>

            {/* Divisions list */}
            <div>
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">Active Divisions</h4>
                {divisions.length === 0 ? (
                    <div className="text-center py-8 bg-slate-800/10 rounded-xl border border-dashed border-slate-700/50 text-slate-500 text-xs">
                        No divisions set up yet. Your organization currently functions under a single default namespace.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {divisions.map((div, idx) => (
                            <div key={div.id || idx} className="flex justify-between items-center bg-slate-800/40 border border-slate-700/60 p-4 rounded-xl hover:border-slate-600/80 transition-all">
                                <div>
                                    <p className="text-sm font-bold text-white">{div.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] bg-slate-700 text-slate-300 font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                                            {div.trade}
                                        </span>
                                        <span className="text-[9px] text-slate-500">
                                            ID: {div.id}
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleRemoveDivision(div.id)}
                                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Delete Division"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
};
