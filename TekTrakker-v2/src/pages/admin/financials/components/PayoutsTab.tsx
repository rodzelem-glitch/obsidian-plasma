import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';

interface PayoutsTabProps {
    payouts: any[];
}

const PayoutsTab: React.FC<PayoutsTabProps> = ({ payouts }) => {
    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white">Bank Payouts</h3>
                <p className="text-sm text-gray-500">Track funds deposited into your linked bank account.</p>
            </div>
            {payouts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <p>No payout history available yet.</p>
                    <p className="text-xs mt-2">Payouts will appear here once funds are transferred to your bank.</p>
                </div>
            ) : (
                <Table headers={['Date', 'Arrival Date', 'Amount', 'Status', 'Descriptor', 'Payout ID']}>
                    {payouts.map(p => (
                        <tr key={p.id}>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {new Date(p.created * 1000 || p.created).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {p.arrivalDate ? new Date(p.arrivalDate * 1000 || p.arrivalDate).toLocaleDateString() : 'Pending'}
                            </td>
                            <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                                ${(p.amount / 100).toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    p.status === 'paid' ? 'bg-green-100 text-green-800' :
                                    p.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {p.status || 'pending'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {p.statementDescriptor || 'Tilled Payout'}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                                {p.id}
                            </td>
                        </tr>
                    ))}
                </Table>
            )}
        </Card>
    );
};

export default PayoutsTab;
