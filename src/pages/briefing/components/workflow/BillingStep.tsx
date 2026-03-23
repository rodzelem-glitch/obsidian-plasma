import React from 'react';
import { CheckCircle, DollarSign, LogOut } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';

interface BillingStepProps {
    handleGoToPayments: () => void;
    handleLeaveSite: () => void;
}

const BillingStep: React.FC<BillingStepProps> = ({
    handleGoToPayments,
    handleLeaveSite
}) => {
    return (
        <div className="space-y-6">
            <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200">
                <div className="text-center p-6">
                    <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4"/>
                    <h3 className="text-2xl font-black text-emerald-800 dark:text-emerald-300">Job Wrapped Up?</h3>
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-2">Ready for Billing</p>
                </div>
            </Card>
            <div className="grid grid-cols-1 gap-4">
                <Button 
                    onClick={handleGoToPayments} 
                    className="h-16 text-lg font-black bg-slate-900 text-white shadow-xl flex items-center justify-center gap-3"
                >
                    <DollarSign size={24}/> Review Invoice & Collect Payment
                </Button>
                <Button 
                    onClick={handleLeaveSite} 
                    variant="danger" 
                    className="h-12 flex items-center justify-center"
                >
                    <LogOut size={20} className="mr-2"/> Complete Job & Leave Site
                </Button>
            </div>
        </div>
    );
};

export default BillingStep;
