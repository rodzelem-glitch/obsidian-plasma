
import React from 'react';
import { Info } from 'lucide-react';
import Input from 'components/ui/Input';
import type { Job } from 'types';

interface InvoiceHeaderProps {
    customerName: string;
    setCustomerName: (name: string) => void;
    address: string;
    setAddress: (address: string) => void;
    currentJob: Job | null;
}

const InvoiceHeader: React.FC<InvoiceHeaderProps> = ({ customerName, setCustomerName, address, setAddress, currentJob }) => {
    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 space-y-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                    label="Customer" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)} 
                />
                <Input 
                    label="Service Address" 
                    value={address} 
                    onChange={e => setAddress(e.target.value)} 
                />
            </div>
            {currentJob?.updatedByName && (
                <p className="text-[10px] text-gray-400 font-black uppercase flex items-center gap-1 tracking-widest">
                    <Info size={10} className="text-primary-500" /> 
                    Last Modified By: {currentJob.updatedByName} at {new Date(currentJob.updatedAt || '').toLocaleString()}
                </p>
            )}
        </div>
    );
};

export default InvoiceHeader;
