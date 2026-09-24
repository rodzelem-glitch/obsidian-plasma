
import React from 'react';
import { Info } from 'lucide-react';
import Input from 'components/ui/Input';
import Select from '../../ui/Select';
import type { Job, Customer } from 'types';
import { getPaymentTermsDays, formatAddress, formatFullAddress } from 'lib/utils';

interface InvoiceHeaderProps {
    customerName: string;
    setCustomerName: (name: string) => void;
    address: string;
    setAddress: (address: string) => void;
    billToName?: string;
    setBillToName?: (name: string) => void;
    billToAddress?: string;
    setBillToAddress?: (address: string) => void;
    invoiceDate: string;
    setInvoiceDate: (date: string) => void;
    dueDate: string;
    setDueDate: (date: string) => void;
    paymentTerms: string;
    setPaymentTerms: (terms: string) => void;
    displayFormat?: 'itemized' | 'progressive';
    setDisplayFormat?: (format: 'itemized' | 'progressive') => void;
    currentJob: Job | null;
    customer?: Customer | null;
}

const formatServiceLocationAddress = (loc: any) => {
    if (!loc) return '';
    return formatFullAddress(loc, loc?.city, loc?.state, loc?.zip);
};

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({ 
    customerName, setCustomerName, 
    address, setAddress, 
    billToName, setBillToName,
    billToAddress, setBillToAddress,
    invoiceDate, setInvoiceDate,
    dueDate, setDueDate,
    paymentTerms, setPaymentTerms,
    displayFormat = 'itemized', setDisplayFormat,
    currentJob,
    customer
}) => {
    const handleInvoiceDateChange = (val: string) => {
        setInvoiceDate(val);
        if (val && paymentTerms) {
            const days = getPaymentTermsDays(paymentTerms);
            const cleanStr = val.includes('T') ? val.split('T')[0] : val;
            const dateObj = new Date(cleanStr.replace(/-/g, '/'));
            if (!isNaN(dateObj.getTime())) {
                dateObj.setDate(dateObj.getDate() + days);
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                setDueDate(`${yyyy}-${mm}-${dd}`);
            }
        }
    };

    const handlePaymentTermsChange = (val: string) => {
        setPaymentTerms(val);
        if (invoiceDate && val) {
            const days = getPaymentTermsDays(val);
            const cleanStr = invoiceDate.includes('T') ? invoiceDate.split('T')[0] : invoiceDate;
            const dateObj = new Date(cleanStr.replace(/-/g, '/'));
            if (!isNaN(dateObj.getTime())) {
                dateObj.setDate(dateObj.getDate() + days);
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                setDueDate(`${yyyy}-${mm}-${dd}`);
            }
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 space-y-4 shadow-sm">
            {/* Split Billing / Parent Company vs Property Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="space-y-4 border-r border-slate-200 dark:border-slate-700 pr-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase">Billing Information (Bill-To)</h4>
                    <Input 
                        label="Billing Name / Company" 
                        value={billToName || customerName} 
                        onChange={e => setBillToName && setBillToName(e.target.value)} 
                        placeholder={customerName}
                    />
                    {customer && (
                        <Select
                            label="Select Billing Address"
                            value={customer.serviceLocations?.some(l => formatServiceLocationAddress(l) === billToAddress) ? billToAddress : (formatServiceLocationAddress(customer) === billToAddress ? billToAddress : '')}
                            onChange={e => {
                                if (e.target.value) {
                                    const selectedVal = e.target.value;
                                    setBillToAddress && setBillToAddress(selectedVal);
                                    if (setBillToName) {
                                        const corpAddr = formatServiceLocationAddress(customer);
                                        if (selectedVal === corpAddr) {
                                            setBillToName(customer.name);
                                        } else {
                                            const matchedLoc = customer.serviceLocations?.find(
                                                (l: any) => formatServiceLocationAddress(l) === selectedVal
                                            );
                                            setBillToName(
                                                matchedLoc?.billToName ||
                                                matchedLoc?.propertyName ||
                                                matchedLoc?.name ||
                                                customer.name
                                            );
                                        }
                                    }
                                }
                            }}
                        >
                            <option value="">-- Choose billing address --</option>
                            {formatServiceLocationAddress(customer) && (
                                <option value={formatServiceLocationAddress(customer)}>
                                    {customer.name} (Corporate: {formatServiceLocationAddress(customer)})
                                </option>
                            )}
                            {customer.serviceLocations && customer.serviceLocations.map((loc: any) => {
                                const locAddr = formatServiceLocationAddress(loc);
                                const storeNum = loc.storeNumber || loc.locationNumber;
                                const storeText = storeNum ? ` [Store #: ${storeNum}]` : '';
                                return (
                                    <option key={loc.id} value={locAddr}>
                                        {(loc.name || loc.propertyName) ? `${loc.name || loc.propertyName} (${locAddr})${storeText}` : `${locAddr}${storeText}`}
                                    </option>
                                );
                            })}
                        </Select>
                    )}
                    <Input 
                        label="Billing Address" 
                        value={billToAddress || address} 
                        onChange={e => setBillToAddress && setBillToAddress(e.target.value)} 
                        placeholder={address}
                    />
                </div>
                <div className="space-y-4 pl-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase">Service Location (Ship-To)</h4>
                    <Input 
                        label="Service Target Name" 
                        value={customerName} 
                        onChange={e => setCustomerName(e.target.value)} 
                        placeholder="e.g. Property Name or Tenant"
                    />
                    {customer?.serviceLocations && customer.serviceLocations.length > 0 && (
                        <Select
                            label="Select Service Location Address"
                            value={customer.serviceLocations.some(l => formatServiceLocationAddress(l) === address) ? address : (formatAddress(customer.address) === address ? address : '')}
                            onChange={e => {
                                if (e.target.value) {
                                    setAddress(e.target.value);
                                    const matchingLoc = customer.serviceLocations.find(l => formatServiceLocationAddress(l) === e.target.value);
                                    if (matchingLoc && (matchingLoc.name || matchingLoc.propertyName)) {
                                        if (!customer?.customerType || customer.customerType === 'Residential') {
                                            setCustomerName(matchingLoc.name || matchingLoc.propertyName);
                                        }
                                    } else if (e.target.value === formatAddress(customer.address)) {
                                        setCustomerName(customer.name);
                                    }
                                }
                            }}
                        >
                            <option value="">-- Choose a location --</option>
                            {formatAddress(customer.address) && (
                                <option value={formatAddress(customer.address)}>
                                    {customer.name || 'Main Address'} (Main: {formatAddress(customer.address)})
                                </option>
                            )}
                            {customer.serviceLocations.map((loc: any) => {
                                const locAddr = formatServiceLocationAddress(loc);
                                const storeNum = loc.storeNumber || loc.locationNumber;
                                const storeText = storeNum ? ` [Store #: ${storeNum}]` : '';
                                return (
                                    <option key={loc.id} value={locAddr}>
                                        {(loc.name || loc.propertyName) ? `${loc.name || loc.propertyName} (${locAddr})${storeText}` : `${locAddr}${storeText}`}
                                    </option>
                                );
                            })}
                        </Select>
                    )}
                    <Input 
                        label="Service Address" 
                        value={address} 
                        onChange={e => setAddress(e.target.value)} 
                    />
                </div>
            </div>

            {/* Invoice Dates & Terms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-200 dark:border-slate-750">
                <Input 
                    label="Invoice Date" 
                    type="date"
                    value={invoiceDate} 
                    onChange={e => handleInvoiceDateChange(e.target.value)} 
                />
                <Select
                    label="Payment Terms"
                    value={paymentTerms}
                    onChange={e => handlePaymentTermsChange(e.target.value)}
                >
                    <option value="due_on_receipt">Due on Receipt</option>
                    <option value="net_7">Net 7</option>
                    <option value="net_15">Net 15</option>
                    <option value="net_30">Net 30</option>
                    <option value="net_45">Net 45</option>
                    <option value="net_60">Net 60</option>
                    <option value="net_90">Net 90</option>
                    {!['due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90'].includes(paymentTerms) && (
                        <option value={paymentTerms}>
                            {paymentTerms.startsWith('net_') ? `Net ${paymentTerms.replace('net_', '')}` : `Custom (${paymentTerms})`}
                        </option>
                    )}
                </Select>
                <Input 
                    label="Due Date" 
                    type="date"
                    value={dueDate} 
                    onChange={e => setDueDate(e.target.value)} 
                />
            </div>

            {/* Display Layout Format Toggle */}
            {setDisplayFormat && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl">
                    <div>
                        <h4 className="text-xs font-black uppercase text-indigo-950 dark:text-indigo-200 tracking-wider flex items-center gap-1.5">
                            📋 Invoice Presentation Format
                        </h4>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium mt-0.5">
                            Select how line items appear on customer payment links, viewer modals, and PDFs.
                        </p>
                    </div>
                    <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-indigo-200 dark:border-indigo-800 shrink-0">
                        <button
                            type="button"
                            onClick={() => setDisplayFormat('itemized')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                displayFormat === 'itemized'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            📄 Itemized Breakdown (As Typed)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDisplayFormat('progressive')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                displayFormat === 'progressive'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            📊 Grouped Progress Matrix (AIA)
                        </button>
                    </div>
                </div>
            )}

            {/* JOB EXECUTION & REFERENCE SUMMARY */}
            {currentJob && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Work Order / PO #</span>
                        <span className="font-black text-slate-800 dark:text-slate-200 truncate block">
                            {currentJob.poNumber || (currentJob as any).workOrderNumber || currentJob.invoice?.poNumber || (currentJob as any).po || 'Not Specified'}
                        </span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Techs Assigned</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {Array.isArray((currentJob as any).assignedTechNames) && (currentJob as any).assignedTechNames.length > 0
                                ? `${(currentJob as any).assignedTechNames.length} Techs (${(currentJob as any).assignedTechNames.join(', ')})`
                                : ((currentJob as any).assignedTechName || (currentJob as any).assignedTech || 'Unassigned')}
                        </span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase block">On-Site Time</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {(currentJob as any).durationHours || (currentJob as any).onSiteHours || (currentJob as any).techHours ? `${(currentJob as any).durationHours || (currentJob as any).onSiteHours || (currentJob as any).techHours} hrs` : 'Logged on Completion'}
                        </span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Equipment Serial #</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {(currentJob as any).equipmentSerial || (currentJob as any).equipment?.[0]?.serialNumber || (currentJob as any).serialNumber || 'N/A'}
                        </span>
                    </div>
                </div>
            )}

            {currentJob?.updatedByName && (
                <p className="text-[10px] text-gray-400 font-black uppercase flex items-center gap-1 tracking-widest pt-2">
                    <Info size={10} className="text-primary-500" /> 
                    Last Modified By: {currentJob.updatedByName} at {new Date(currentJob.updatedAt || '').toLocaleString()}
                </p>
            )}
        </div>
    );
};

export default InvoiceHeader;
