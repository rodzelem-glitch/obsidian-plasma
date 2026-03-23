
import React from 'react';
import Card from 'components/ui/Card';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface FinancialOverviewProps {
    financialData: {
        totalCollected: number;
        totalExpenses: number;
        netIncome: number;
        receivables: number;
    };
    setView: (view: any) => void;
}

const FinancialOverview: React.FC<FinancialOverviewProps> = ({ financialData, setView }) => {
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card onClick={() => setView('pnl')} className="bg-green-50 dark:bg-green-900/20 border-green-200 cursor-pointer hover:bg-green-100 transition-colors">
                <p className="text-xs font-bold text-green-700 uppercase">Gross Revenue (Collected)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(financialData.totalCollected)}</p>
            </Card>
            <Card onClick={() => setView('expenses')} className="bg-red-50 dark:bg-red-900/20 border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
                <p className="text-xs font-bold text-red-700 uppercase">Total Expenses</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(financialData.totalExpenses)}</p>
            </Card>
            <Card onClick={() => setView('pnl')} className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors">
                <p className="text-xs font-bold text-blue-700 uppercase">Net Profit</p>
                <p className={`text-2xl font-bold ${financialData.netIncome >= 0 ? 'text-blue-900' : 'text-red-600'}`}>{fmt(financialData.netIncome)}</p>
            </Card>
            <Card onClick={() => setView('invoices')} className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors">
                <p className="text-xs font-bold text-yellow-700 uppercase">Outstanding (A/R)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(financialData.receivables)}</p>
            </Card>
        </div>
    );
};

export default FinancialOverview;
