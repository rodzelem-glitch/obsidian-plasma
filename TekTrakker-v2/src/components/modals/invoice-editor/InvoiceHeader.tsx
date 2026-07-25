
import React from 'react';
import { Info } from 'lucide-react';
import Input from 'components/ui/Input';
import Select from '../../ui/Select';
import type { Job, Customer } from 'types';
import { getPaymentTermsDays, formatAddress } from 'lib/utils';

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
    currentJob: Job | null;
    customer?: Customer | null;
}

const formatServiceLocationAddress = (loc: any) => {
    if (!loc) return '';
    let addressStr = loc.address || '';
    
    const details = [];
    if (loc.city && !addressStr.includes(loc.city)) details.push(loc.city);
    if (loc.state && !addressStr.includes(loc.state)) details.push(loc.state);
    if (loc.zip && !addressStr.includes(loc.zip)) details.push(loc.zip);
    
    if (details.length > 0) {
        if (addressStr) {
            addressStr = `${addressStr}, ${details.join(', ')}`;
        } else {
            addressStr = details.join(', ');
        }
    }
    return addressStr;
};

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({ 
    customerName, setCustomerName, 
    address, setAddress, 
    billToName, setBillToName,
    billToAddress, setBillToAddress,
    invoiceDate, setInvoiceDate,
    dueDate, setDueDate,
    paymentTerms, setPaymentTerms,
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
                                    setBillToAddress && setBillToAddress(e.target.value);
                                    setBillToName && setBillToName(customer.name);
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
                                const poText = loc.poNumber ? ` [PO: ${loc.poNumber}]` : '';
                                return (
                                    <option key={loc.id} value={locAddr}>
                                        {(loc.name || loc.propertyName) ? `${loc.name || loc.propertyName} (${locAddr})${poText}` : `${locAddr}${poText}`}
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
                                        setCustomerName(matchingLoc.name || matchingLoc.propertyName);
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
                                const poText = loc.poNumber ? ` [PO: ${loc.poNumber}]` : '';
                                return (
                                    <option key={loc.id} value={locAddr}>
                                        {(loc.name || loc.propertyName) ? `${loc.name || loc.propertyName} (${locAddr})${poText}` : `${locAddr}${poText}`}
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
