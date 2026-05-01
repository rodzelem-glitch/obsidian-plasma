
import React from 'react';
import type { User } from 'types';
import { formatAddress } from 'lib/utils';

interface Form1099CopyAProps {
    recipient: any;
    amount: number;
    year: number;
    payerName?: string;
}

const Form1099CopyA: React.FC<Form1099CopyAProps> = ({ recipient, amount, year, payerName = 'TekTrakker Platform' }) => (
    <div className="border-2 border-red-800 text-red-900 font-serif max-w-3xl mx-auto my-4 relative p-4 md:p-8 bg-white print:block">
        <div className="absolute top-2 left-2 text-[10px]">DO NOT CUT OR SEPARATE FORMS ON THIS PAGE</div>
        <div className="text-center border-b-2 border-red-800 pb-4 mb-4">
            <h2 className="text-2xl font-bold">Form 1099-NEC (Copy A)</h2>
            <p className="text-sm">For Internal Revenue Service Center</p>
            <p className="text-xl font-bold">{year}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 text-black">
                <div className="border border-red-300 p-2">
                    <p className="text-[10px] uppercase">Payer's Info</p>
                    <p className="font-bold">{payerName}</p>
                    <p>EIN: 12-3456789</p>
                </div>
                <div className="border border-red-300 p-2">
                    <p className="text-[10px] uppercase">Recipient's TIN</p>
                    <p>{recipient.taxId || recipient.ssn || 'XXX-XX-XXXX'}</p>
                </div>
                <div className="border border-red-300 p-2">
                    <p className="text-[10px] uppercase">Recipient's Name</p>
                    <p>{recipient.companyName || `${recipient.firstName} ${recipient.lastName}`}</p>
                    <p>{formatAddress(recipient.address) || 'Address on File'}</p>
                </div>
            </div>
            <div className="space-y-4 text-black">
                <div className="border border-red-300 p-4 bg-red-50">
                    <p className="text-[10px] uppercase mb-1">1. Nonemployee Compensation</p>
                    <p className="text-2xl font-mono font-bold">${amount.toFixed(2)}</p>
                </div>
                <div className="border border-red-300 p-2">
                    <p className="text-[10px] uppercase">4. Federal Income Tax Withheld</p>
                    <p>$0.00</p>
                </div>
            </div>
        </div>
        <div className="mt-8 text-[10px] text-center text-red-800">
            For Official Use Only - Copy A
        </div>
    </div>
);

export default Form1099CopyA;
