
import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { CheckCircle, RefreshCw } from 'lucide-react';

interface AccountingTabProps {
    quickbooksConnected?: boolean;
    handleConnectQuickBooks?: () => void;
    handleDisconnectQuickBooks?: () => void;
    isConnectingQuickbooks?: boolean;
}

const AccountingTab: React.FC<AccountingTabProps> = ({
    quickbooksConnected,
    handleConnectQuickBooks,
    handleDisconnectQuickBooks,
    isConnectingQuickbooks
}) => {
    return (
        <Card>
            <h3 className="text-lg font-bold mb-6 text-green-700">Accounting Software</h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border p-1">
                            <span className="font-bold text-green-600 text-xs">QBO</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">QuickBooks Online</h4>
                            <p className="text-xs text-slate-500">Sync invoices, customers, and payments.</p>
                        </div>
                    </div>
                    <div>
                        {quickbooksConnected ? (
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                                    <CheckCircle size={12} /> Connected
                                </span>
                                <Button onClick={handleDisconnectQuickBooks} variant="secondary" className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100">
                                    Disconnect
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={handleConnectQuickBooks} disabled={isConnectingQuickbooks} className="bg-green-600 hover:bg-green-700 text-xs font-bold uppercase tracking-wide">
                                {isConnectingQuickbooks ? <RefreshCw className="animate-spin" size={14} /> : 'Connect to QuickBooks'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default AccountingTab;
