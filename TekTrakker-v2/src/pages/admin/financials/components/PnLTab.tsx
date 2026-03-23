
import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Calculator, Printer } from 'lucide-react';

interface PnLTabProps {
    financialData: any;
    setIsReportModalOpen: (val: boolean) => void;
}

const PnLTab: React.FC<PnLTabProps> = ({ financialData, setIsReportModalOpen }) => {
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Calculator size={20}/> Profit & Loss Statement</h3>
                <Button onClick={() => setIsReportModalOpen(true)} variant="secondary" className="text-xs flex items-center gap-2">
                    <Printer size={14}/> Professional Report
                </Button>
            </div>
            <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-black text-green-800 uppercase text-sm">Total Income</span>
                        <span className="font-black text-xl text-green-800">{fmt(financialData.totalCollected)}</span>
                    </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-100">
                     <div className="flex justify-between items-center mb-2">
                        <span className="font-black text-red-800 uppercase text-sm">Total Expenses</span>
                        <span className="font-black text-xl text-red-800">{fmt(financialData.totalExpenses)}</span>
                    </div>
                    <div className="space-y-1 mt-3">
                        {Object.entries(financialData.expenseCats).map(([cat, amount]: any) => (
                            <div key={cat} className="flex justify-between text-xs text-red-700 border-b border-red-100 pb-1">
                                <span>{cat}</span>
                                <span className="font-bold">{fmt(amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                 <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="font-black text-slate-800 dark:text-slate-200 uppercase text-lg">Net Operating Income</span>
                        <span className={`font-black text-3xl ${financialData.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {fmt(financialData.netIncome)}
                        </span>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default PnLTab;
