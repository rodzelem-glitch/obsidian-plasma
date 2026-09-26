
import React from 'react';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { ToolMaintenanceLog } from 'types';
import { useLanguage } from 'context/LanguageContext';

interface ToolsTabProps {
    toolLogs: ToolMaintenanceLog[];
    setIsLogMaintenanceOpen: (val: boolean) => void;
}

const ToolsTab: React.FC<ToolsTabProps> = ({ toolLogs, setIsLogMaintenanceOpen }) => {
    const { t } = useLanguage();
    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{t("Maintenance Logs")}</h3>
                <Button onClick={() => setIsLogMaintenanceOpen(true)} className="w-auto text-xs">{t("Log Service")}</Button>
            </div>
            {/* Mobile Cards View (App / Mobile View Only) */}
            <div className="md:hidden space-y-3 mb-4">
                {toolLogs.map((log: any) => (
                    <div key={`tool-log-card-${log.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-2.5">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                            <div>
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                    {t(log.toolType)}
                                </span>
                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                    SN: {log.serialNumber}
                                </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${log.result === 'Pass' ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'}`}>
                                {t(log.result)}
                            </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-slate-400 block text-[10px] uppercase">Action</span>
                            <span>{t(log.action)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Date</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {new Date(log.date).toLocaleDateString()}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Next Due</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {log.nextDueDate || '--'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {toolLogs.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                        {t("No tool maintenance logs recorded.")}
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
            <Table headers={[t('Date'), t('Tool'), t('Serial #'), t('Action'), t('Result'), t('Next Due')]}>
                {toolLogs.map((log: any) => (
                    <tr key={log.id}>
                        <td className="px-6 py-4 text-sm">{new Date(log.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-bold">{t(log.toolType)}</td>
                        <td className="px-6 py-4 font-mono">{log.serialNumber}</td>
                        <td className="px-6 py-4">{t(log.action)}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${log.result === 'Pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{t(log.result)}</span></td>
                        <td className="px-6 py-4 text-sm">{log.nextDueDate}</td>
                    </tr>
                ))}
            </Table>
            </div>
        </Card>
    );
};

export default ToolsTab;
