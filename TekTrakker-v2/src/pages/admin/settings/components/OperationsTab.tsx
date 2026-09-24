
import React from 'react';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Toggle from 'components/ui/Toggle';
import Textarea from 'components/ui/Textarea';
import { MapPinIcon, Gavel, Users, Zap, Bot, CreditCard, FileText, Building, CheckSquare, Info } from 'lucide-react';
import { PaymentInstructionsCard } from 'components/payment/PaymentInstructionsCard';

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
    jobPrefix: string;
    setJobPrefix: (val: string) => void;
    jobStartNumber: string;
    setJobStartNumber: (val: string) => void;
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
    lateFeeEnabled: boolean;
    setLateFeeEnabled: (val: boolean) => void;
    lateFeeType: 'flat' | 'percent';
    setLateFeeType: (val: 'flat' | 'percent') => void;
    lateFeeValue: string;
    setLateFeeValue: (val: string) => void;
    lateFeeInterestRate: string;
    setLateFeeInterestRate: (val: string) => void;
    lateFeeGracePeriod: string;
    setLateFeeGracePeriod: (val: string) => void;
    autoSendMonthlyStatements: boolean;
    setAutoSendMonthlyStatements: (val: boolean) => void;
    acceptWire: boolean;
    setAcceptWire: (val: boolean) => void;
    wireInstructions: string;
    setWireInstructions: (val: string) => void;
    acceptCheck: boolean;
    setAcceptCheck: (val: boolean) => void;
    checkInstructions: string;
    setCheckInstructions: (val: string) => void;
    acceptAch: boolean;
    setAcceptAch: (val: boolean) => void;
    achInstructions: string;
    setAchInstructions: (val: string) => void;
    orgName?: string;
    orgAddress?: { street?: string; city?: string; state?: string; zip?: string };
    orgEmail?: string;
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
    jobPrefix, setJobPrefix,
    jobStartNumber, setJobStartNumber,
    invoicePrefix, setInvoicePrefix,
    invoiceStartNumber, setInvoiceStartNumber,
    proposalPrefix, setProposalPrefix,
    proposalStartNumber, setProposalStartNumber,
    allowPartialPayments, setAllowPartialPayments,
    lateFeeEnabled, setLateFeeEnabled,
    lateFeeType, setLateFeeType,
    lateFeeValue, setLateFeeValue,
    lateFeeInterestRate, setLateFeeInterestRate,
    lateFeeGracePeriod, setLateFeeGracePeriod,
    autoSendMonthlyStatements, setAutoSendMonthlyStatements,
    acceptWire, setAcceptWire,
    wireInstructions, setWireInstructions,
    acceptCheck, setAcceptCheck,
    checkInstructions, setCheckInstructions,
    acceptAch, setAcceptAch,
    achInstructions, setAchInstructions,
    orgName = '',
    orgAddress,
    orgEmail = ''
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-indigo-600">
                        <Building size={20} /> Offline &amp; Direct Payment Instructions (Wire, Check, ACH)
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Auto-Populates System-Wide
                    </span>
                </div>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Configure instructions for physical checks, bank wire transfers, and ACH direct deposits. These will automatically populate on customer invoices, invoice PDFs &amp; printouts, deposit requests, and Statement of Account ledgers. Use the checkboxes to control which payment methods your organization accepts.
                </p>

                <div className="space-y-6">
                    {/* Check Payment Instructions */}
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Accept Physical Checks</h4>
                                    <p className="text-xs text-slate-400">Enable check remittance instructions for clients mailing physical checks</p>
                                </div>
                            </div>
                            <Toggle 
                                label="" 
                                enabled={acceptCheck} 
                                onChange={setAcceptCheck} 
                            />
                        </div>

                        {acceptCheck && (
                            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 animate-fade-in space-y-2">
                                <Textarea 
                                    label="Check Payment Instructions"
                                    value={checkInstructions}
                                    onChange={e => setCheckInstructions(e.target.value)}
                                    rows={3}
                                    placeholder={`Make checks payable to: ${orgName || 'Your Business Name'}\nMailing Address: 123 Main St, Suite 100, City, ST 12345\nMemo: Please include Invoice # on check memo line.`}
                                />
                                <p className="text-[11px] text-slate-400 italic">
                                    Leave blank to use smart organization defaults (Payable to {orgName || 'Company'} at your business address).
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Wire Transfer Instructions */}
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                                    <Building size={18} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Accept Wire Transfers</h4>
                                    <p className="text-xs text-slate-400">Enable wire remittance details for high-value or commercial wire transfers</p>
                                </div>
                            </div>
                            <Toggle 
                                label="" 
                                enabled={acceptWire} 
                                onChange={setAcceptWire} 
                            />
                        </div>

                        {acceptWire && (
                            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 animate-fade-in space-y-2">
                                <Textarea 
                                    label="Wire Transfer Instructions"
                                    value={wireInstructions}
                                    onChange={e => setWireInstructions(e.target.value)}
                                    rows={4}
                                    placeholder={`Bank Name: JPMorgan Chase\nAccount Name: ${orgName || 'Your Business LLC'}\nRouting Number (Wire): 123456789\nAccount Number: 987654321\nSwift / BIC: CHASUS33\nReference: Please include Invoice # in wire remittance notes.`}
                                />
                                <p className="text-[11px] text-slate-400 italic">
                                    Include bank name, wire routing number, account number, beneficiary name, and any reference codes.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ACH / Direct Bank Transfer Instructions */}
                    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    <CreditCard size={18} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Accept ACH / Direct Deposit</h4>
                                    <p className="text-xs text-slate-400">Enable ACH transfer information for automated or direct bank deposits</p>
                                </div>
                            </div>
                            <Toggle 
                                label="" 
                                enabled={acceptAch} 
                                onChange={setAcceptAch} 
                            />
                        </div>

                        {acceptAch && (
                            <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 animate-fade-in space-y-2">
                                <Textarea 
                                    label="ACH / Direct Deposit Instructions"
                                    value={achInstructions}
                                    onChange={e => setAchInstructions(e.target.value)}
                                    rows={4}
                                    placeholder={`Bank Name: JPMorgan Chase\nAccount Name: ${orgName || 'Your Business LLC'}\nRouting Number (ACH): 123456789\nAccount Number: 987654321\nAccount Type: Business Checking\nRemittance: Email remittance notification to ${orgEmail || 'billing@example.com'}.`}
                                />
                                <p className="text-[11px] text-slate-400 italic">
                                    Specify ACH routing number, account number, account type, and remittance notification email.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Live Preview Card */}
                    {(acceptCheck || acceptWire || acceptAch) && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                                Client Preview (How Instructions Appear on Invoices &amp; Portals)
                            </h5>
                            <PaymentInstructionsCard 
                                organization={{
                                    name: orgName,
                                    address: orgAddress as any,
                                    email: orgEmail,
                                    acceptCheck,
                                    checkInstructions,
                                    acceptWire,
                                    wireInstructions,
                                    acceptAch,
                                    achInstructions
                                } as any}
                            />
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600">
                    <Gavel size={20} /> Late Fees & Interest Rates
                </h3>
                <p className="text-xs text-slate-500 mb-6 -mt-4 leading-relaxed">
                    Automatically calculate late fees and interest rates for outstanding customer invoices that have missed their due date.
                </p>
                <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200">Enable Late Fees & Interest</h4>
                                <p className="text-xs text-slate-400">Assess charges automatically when due dates are missed</p>
                            </div>
                            <Toggle 
                                label="" 
                                enabled={lateFeeEnabled} 
                                onChange={setLateFeeEnabled} 
                            />
                        </div>
                        {lateFeeEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 animate-fade-in border-t border-slate-200/50 pt-4">
                                <div className="space-y-4">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Surcharge (One-Time)</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="late-fee-type" className="block text-xs font-medium text-slate-555 mb-1">Fee Type</label>
                                            <select
                                                id="late-fee-type"
                                                value={lateFeeType}
                                                onChange={e => setLateFeeType(e.target.value as 'flat' | 'percent')}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="flat">Flat Fee ($)</option>
                                                <option value="percent">Percentage (%)</option>
                                            </select>
                                        </div>
                                        <Input 
                                            id="late-fee-value" 
                                            label={lateFeeType === 'flat' ? 'Flat Amount ($)' : 'Percentage (%)'} 
                                            type="number" 
                                            step="0.01" 
                                            value={lateFeeValue} 
                                            onChange={e => setLateFeeValue(e.target.value)} 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grace Period & Monthly Accruals</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input 
                                            id="late-fee-grace" 
                                            label="Grace Period (Days)" 
                                            type="number" 
                                            value={lateFeeGracePeriod} 
                                            onChange={e => setLateFeeGracePeriod(e.target.value)} 
                                        />
                                        <Input 
                                            id="late-fee-interest" 
                                            label="Monthly Interest Rate (%)" 
                                            type="number" 
                                            step="0.01" 
                                            value={lateFeeInterestRate} 
                                            onChange={e => setLateFeeInterestRate(e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600">
                    <FileText size={20} /> Automated Monthly Statements
                </h3>
                <p className="text-xs text-slate-500 mb-6 -mt-4 leading-relaxed">
                    Automatically email Statement of Account ledgers to commercial customers with unpaid balances at the end of each month.
                </p>
                <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200">Auto-Send Monthly Statements</h4>
                                <p className="text-xs text-slate-400">Automatically send statements to commercial accounts with outstanding balances on the last day of every month</p>
                            </div>
                            <Toggle 
                                label="" 
                                enabled={autoSendMonthlyStatements} 
                                onChange={setAutoSendMonthlyStatements} 
                            />
                        </div>
                    </div>
                </div>
            </Card>
            
            <Card>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-indigo-600">
                    <Zap size={20} /> Custom Document Numbering Schemes
                </h3>
                <p className="text-xs text-slate-500 mb-6 -mt-4 leading-relaxed">
                    Configure custom prefixes and sequence starting numbers for your organization's Jobs, Invoices, and Proposals. Related documents will automatically synchronize to their corresponding Job sequence.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Job Numbering */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Job Series</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                id="job-prefix"
                                label="Prefix (e.g. Job-)"
                                value={jobPrefix}
                                onChange={e => setJobPrefix(e.target.value)}
                            />
                            <Input
                                id="job-start-num"
                                label="Start Number"
                                type="number"
                                value={jobStartNumber}
                                onChange={e => setJobStartNumber(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">
                            Next Job: <span className="font-bold text-indigo-500">{jobPrefix}{jobStartNumber}</span>
                        </p>
                    </div>

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
