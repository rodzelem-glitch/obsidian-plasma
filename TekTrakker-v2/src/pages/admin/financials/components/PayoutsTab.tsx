import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import { useLanguage } from 'context/LanguageContext';

interface PayoutsTabProps {
    payouts: any[];
}

const PayoutsTab: React.FC<PayoutsTabProps> = ({ payouts }) => {
    const { t } = useLanguage();
    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white">{t("Bank Payouts")}</h3>
                <p className="text-sm text-gray-500">{t("Track funds deposited into your linked bank account.")}</p>
            </div>
            {payouts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    <p>{t("No payout history available yet.")}</p>
                    <p className="text-xs mt-2">{t("Payouts will appear here once funds are transferred to your bank.")}</p>
                </div>
            ) : (
                <>
                {/* Mobile Cards View (App / Mobile View Only) */}
                <div className="md:hidden space-y-3 mb-4">
                    {payouts.map(p => (
                        <div key={`payout-card-${p.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-2.5">
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                                <div>
                                    <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                                        ${(p.amount / 100).toFixed(2)}
                                    </span>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        {p.statementDescriptor || t('Tilled Payout')}
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    p.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300' :
                                    p.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' :
                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300'
                                }`}>
                                    {t(p.status || 'pending')}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Date</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {new Date(p.created * 1000 || p.created).toLocaleDateString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Arrival</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {p.arrivalDate ? new Date(p.arrivalDate * 1000 || p.arrivalDate).toLocaleDateString() : t('Pending')}
                                    </span>
                                </div>
                            </div>

                            <div className="text-[10px] font-mono text-slate-400 truncate pt-1">
                                ID: {p.id}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                <Table headers={[t('Date'), t('Arrival Date'), t('Amount'), t('Status'), t('Descriptor'), t('Payout ID')]}>
                    {payouts.map(p => (
                        <tr key={p.id}>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {new Date(p.created * 1000 || p.created).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {p.arrivalDate ? new Date(p.arrivalDate * 1000 || p.arrivalDate).toLocaleDateString() : t('Pending')}
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
                                    {t(p.status || 'pending')}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {p.statementDescriptor || t('Tilled Payout')}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                                {p.id}
                            </td>
                        </tr>
                    ))}
                </Table>
                </div>
                </>
            )}
        </Card>
    );
};

export default PayoutsTab;
