
import React from 'react';
import { Info } from 'lucide-react';
import Input from 'components/ui/Input';
import type { Job } from 'types';

interface InvoiceHeaderProps {
    customerName: string;
    setCustomerName: (name: string) => void;
    address: string;
    setAddress: (address: string) => void;
    billToName?: string;
    setBillToName?: (name: string) => void;
    billToAddress?: string;
    setBillToAddress?: (address: string) => void;
    currentJob: Job | null;
}

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({ 
    customerName, setCustomerName, 
    address, setAddress, 
    billToName, setBillToName,
    billToAddress, setBillToAddress,
    currentJob 
}) => {
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
                    <Input 
                        label="Service Address" 
                        value={address} 
                        onChange={e => setAddress(e.target.value)} 
                    />
                </div>
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
