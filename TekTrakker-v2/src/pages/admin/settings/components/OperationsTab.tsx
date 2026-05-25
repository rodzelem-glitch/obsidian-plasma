
import React from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Toggle from 'components/ui/Toggle';
import { MapPinIcon, Gavel, Users, Zap, Bot, CreditCard } from 'lucide-react';

interface OperationsTabProps {
    address: string;
    setAddress: (val: string) => void;
    city: string;
    setCity: (val: string) => void;
    stateName: string;
    setStateName: (val: string) => void;
    zip: string;
    setZip: (val: string) => void;
    taxRate: string;
    setTaxRate: (val: string) => void;
    licenseNumber: string;
    setLicenseNumber: (val: string) => void;
    primaryNaics: string;
    setPrimaryNaics: (val: string) => void;
    ueid: string;
    setUeid: (val: string) => void;
    cageCode: string;
    setCageCode: (val: string) => void;
    customPositions: string[];
    newPosition: string;
    setNewPosition: (val: string) => void;
    handleAddItem: (type: 'position' | 'cert') => void;
    handleRemoveItem: (type: 'position' | 'cert', index: number) => void;
    requiredCerts: string[];
    newCert: string;
    setNewCert: (val: string) => void;
    marketMultiplier: string;
    setMarketMultiplier: (val: string) => void;
    aiPricebookEnabled: boolean;
    setAiPricebookEnabled: (val: boolean) => void;
    virtualWorkerEnabled: boolean;
    setVirtualWorkerEnabled: (val: boolean) => void;
    cardProcessingFeeEnabled: boolean;
    setCardProcessingFeeEnabled: (val: boolean) => void;
    cardProcessingFeePercent: string;
    setCardProcessingFeePercent: (val: string) => void;
    cardProcessingFeeFlat: string;
    setCardProcessingFeeFlat: (val: string) => void;
    achProcessingFeeEnabled: boolean;
    setAchProcessingFeeEnabled: (val: boolean) => void;
    achProcessingFeePercent: string;
    setAchProcessingFeePercent: (val: string) => void;
    achProcessingFeeFlat: string;
    setAchProcessingFeeFlat: (val: string) => void;
    invoicePrefix: string;
    setInvoicePrefix: (val: string) => void;
    invoiceStartNumber: string;
    setInvoiceStartNumber: (val: string) => void;
    proposalPrefix: string;
    setProposalPrefix: (val: string) => void;
    proposalStartNumber: string;
    setProposalStartNumber: (val: string) => void;
    allowPartialPayments: boolean;
    setAllowPartialPayments: (val: boolean) => void;
}

const OperationsTab: React.FC<OperationsTabProps> = ({
    address, setAddress,
    city, setCity,
    stateName, setStateName,
    zip, setZip,
    taxRate, setTaxRate,
    licenseNumber, setLicenseNumber,
    primaryNaics, setPrimaryNaics,
    ueid, setUeid,
    cageCode, setCageCode,
    customPositions, newPosition, setNewPosition,
    handleAddItem, handleRemoveItem,
    requiredCerts, newCert, setNewCert,
    marketMultiplier, setMarketMultiplier,
    aiPricebookEnabled, setAiPricebookEnabled,
    virtualWorkerEnabled, setVirtualWorkerEnabled,
    cardProcessingFeeEnabled, setCardProcessingFeeEnabled,
    cardProcessingFeePercent, setCardProcessingFeePercent,
    cardProcessingFeeFlat, setCardProcessingFeeFlat,
    achProcessingFeeEnabled, setAchProcessingFeeEnabled,
    achProcessingFeePercent, setAchProcessingFeePercent,
    achProcessingFeeFlat, setAchProcessingFeeFlat,
    invoicePrefix, setInvoicePrefix,
    invoiceStartNumber, setInvoiceStartNumber,
    proposalPrefix, setProposalPrefix,
    proposalStartNumber, setProposalStartNumber,
    allowPartialPayments, setAllowPartialPayments
}) => {
    return (
        <div className="space-y-6">
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600"><MapPinIcon size={20}/> HQ & Tax</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <Input id="op-addr" label="Street Address" value={address} onChange={e => setAddress(e.target.value)} />
                    </div>
                    <Input id="op-tax" label="Sales Tax Rate (%)" type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} />
                    <Input id="op-city" label="City" value={city} onChange={e => setCity(e.target.value)} />
                    <Input id="op-state" label="State" value={stateName} onChange={e => setStateName(e.target.value)} />
                    <Input id="op-zip" label="Zip Code" value={zip} onChange={e => setZip(e.target.value)} />
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600">
                    <CreditCard size={20} /> Invoice Processing Fees
                </h3>
                <p className="text-xs text-slate-500 mb-6 -mt-4 leading-relaxed">
                    Set up processing fees that will be automatically added to customer invoices depending on their chosen checkout method.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Credit Card Processing Fee */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200">Credit Card Fees</h4>
                                <p className="text-xs text-slate-400">Pass-through fee on CC payments</p>
                            </div>
                            <Toggle 
                                label="" 
                                enabled={cardProcessingFeeEnabled} 
                                onChange={setCardProcessingFeeEnabled} 
                            />
                        </div>
                        {cardProcessingFeeEnabled && (
                            <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-in">
                                <Input 
                                    id="cc-fee-pct" 
                                    label="Percentage Fee (%)" 
                                    type="number" 
                                    step="0.01" 
                                    value={cardProcessingFeePercent} 
                                    onChange={e => setCardProcessingFeePercent(e.target.value)} 
                                />
                                <Input 
                                    id="cc-fee-flat" 
                                    label="Flat Fee ($)" 
                                    type="number" 
                                    step="0.01" 
                                    value={cardProcessingFeeFlat} 
                                    onChange={e => setCardProcessingFeeFlat(e.target.value)} 
                                />
                            </div>
                        )}
                    </div>

                    {/* ACH / Bank Processing Fee */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200">ACH / Bank Fees</h4>
                                <p className="text-xs text-slate-400">Pass-through fee on ACH payments</p>
                            </div>
                            <Toggle 
                                label="" 
                                enabled={achProcessingFeeEnabled} 
                                onChange={setAchProcessingFeeEnabled} 
                            />
                        </div>
                        {achProcessingFeeEnabled && (
                            <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-in">
                                <Input 
                                    id="ach-fee-pct" 
                                    label="Percentage Fee (%)" 
                                    type="number" 
                                    step="0.01" 
                                    value={achProcessingFeePercent} 
                                    onChange={e => setAchProcessingFeePercent(e.target.value)} 
                                />
                                <Input 
                                    id="ach-fee-flat" 
                                    label="Flat Fee ($)" 
                                    type="number" 
                                    step="0.01" 
                                    value={achProcessingFeeFlat} 
                                    onChange={e => setAchProcessingFeeFlat(e.target.value)} 
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600">
                    <CreditCard size={20} /> Invoice Payment Options
                </h3>
                <p className="text-xs text-slate-500 mb-6 -mt-4 leading-relaxed">
                    Configure customer-facing payment options for outstanding invoices.
                </p>
                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200">Allow Partial Payments</h4>
                            <p className="text-xs text-slate-400">Enable customers to pay invoices in multiple increments rather than forcing the full balance.</p>
                        </div>
                        <Toggle 
                            label="" 
                            enabled={allowPartialPayments} 
                            onChange={setAllowPartialPayments} 
                        />
                    </div>
                </div>
            </Card>
            
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600">
                    <Zap size={20} /> Custom Document Numbering Schemes
                </h3>
                <p className="text-xs text-slate-500 mb-6 -mt-4 leading-relaxed">
                    Configure custom prefixes and sequence starting numbers for your organization's Invoices and Proposals. Next document pointer will automatically initialize or synchronize if starting numbers change.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Invoice Numbering */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Invoice Series</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                id="inv-prefix"
                                label="Prefix (e.g. INV-)"
                                value={invoicePrefix}
                                onChange={e => setInvoicePrefix(e.target.value)}
                            />
                            <Input
                                id="inv-start-num"
                                label="Start Number"
                                type="number"
                                value={invoiceStartNumber}
                                onChange={e => setInvoiceStartNumber(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                            Next Invoice: <span className="font-bold text-indigo-500">{invoicePrefix}{invoiceStartNumber}</span>
                        </p>
                    </div>

                    {/* Proposal Numbering */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Proposal Series</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                id="prop-prefix"
                                label="Prefix (e.g. PROP-)"
                                value={proposalPrefix}
                                onChange={e => setProposalPrefix(e.target.value)}
                            />
                            <Input
                                id="prop-start-num"
                                label="Start Number"
                                type="number"
                                value={proposalStartNumber}
                                onChange={e => setProposalStartNumber(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                            Next Proposal: <span className="font-bold text-indigo-500">{proposalPrefix}{proposalStartNumber}</span>
                        </p>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-600"><Gavel size={20}/> Government & Pricing</h3>
                    <div className="flex items-center gap-4">
                        <Toggle 
                            label="AI Pricebook Generation" 
                            enabled={aiPricebookEnabled} 
                            onChange={setAiPricebookEnabled} 
                        />
                        {virtualWorkerEnabled ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
                                <Bot size={16} />
                                <span className="text-sm font-bold">Virtual Worker Active</span>
                            </div>
                        ) : (
                            <a 
                                href="#/admin/ai-worker-upgrade" 
                                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white rounded-full transition-all shadow-sm"
                            >
                                <Bot size={16} />
                                <span className="text-sm font-bold">Upgrade AI Worker</span>
                            </a>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input id="gov-license" label="State License #" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
                    <Input id="gov-naics" label="Primary NAICS Code" value={primaryNaics} onChange={e => setPrimaryNaics(e.target.value)} />
                    <Input id="gov-ueid" label="UEI (Unique Entity ID)" value={ueid} onChange={e => setUeid(e.target.value)} />
                    <Input id="gov-cage" label="CAGE Code" value={cageCode} onChange={e => setCageCode(e.target.value)} />
                    <div className="md:col-span-2">
                        <Input 
                            id="market-multiplier" 
                            label="Global Market Multiplier (Profit Margin Adjustment)" 
                            type="number" 
                            step="0.01" 
                            value={marketMultiplier} 
                            onChange={e => setMarketMultiplier(e.target.value)} 
                            placeholder="1.0"
                        />
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold flex items-center gap-1">
                            <Zap size={10} /> Multiplies all base material/labor costs in your pricebook by this value.
                        </p>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-purple-600"><Users size={20}/> HR & Workforce Config</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Custom Job Titles</label>
                            <div className="flex gap-2">
                                <input className="text-xs p-1 border rounded w-32 dark:bg-slate-800" placeholder="New Position" value={newPosition} onChange={e => setNewPosition(e.target.value)} />
                                <button onClick={() => handleAddItem('position')} className="text-xs bg-blue-100 text-blue-700 px-2 rounded hover:bg-blue-200">Add</button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 min-h-[80px]">
                            {customPositions.length === 0 && <span className="text-xs text-gray-400 italic">No custom positions added.</span>}
                            {customPositions.map((pos, i) => (
                                <span key={i} className="text-xs bg-white dark:bg-slate-700 border px-2 py-1 rounded flex items-center gap-1">
                                    {pos} <button onClick={() => handleRemoveItem('position', i)} className="text-red-400 hover:text-red-600">&times;</button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Required Certifications</label>
                            <div className="flex gap-2">
                                <input className="text-xs p-1 border rounded w-32 dark:bg-slate-800" placeholder="e.g. OSHA 10" value={newCert} onChange={e => setNewCert(e.target.value)} />
                                <button onClick={() => handleAddItem('cert')} className="text-xs bg-green-100 text-green-700 px-2 rounded hover:bg-green-200">Add</button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 min-h-[80px]">
                            {requiredCerts.length === 0 && <span className="text-xs text-gray-400 italic">No required certs defined.</span>}
                            {requiredCerts.map((cert, i) => (
                                <span key={i} className="text-xs bg-white dark:bg-slate-700 border px-2 py-1 rounded flex items-center gap-1">
                                    {cert} <button onClick={() => handleRemoveItem('cert', i)} className="text-red-400 hover:text-red-600">&times;</button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default OperationsTab;
