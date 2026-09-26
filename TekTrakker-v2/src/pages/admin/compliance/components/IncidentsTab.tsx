
import React from 'react';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Table from '../../../../components/ui/Table';
import type { IncidentReport } from '../../../../types/types';
import { useLanguage } from 'context/LanguageContext';

interface IncidentsTabProps {
    incidents: IncidentReport[];
}

const IncidentsTab: React.FC<IncidentsTabProps> = ({ incidents }) => {
    const { t } = useLanguage();
    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="text-red-500" /> {t("Safety & Hazard Reports")}
                </h3>
            </div>

            {incidents.length > 0 ? (
                <>
                {/* Mobile Cards View (App / Mobile View Only) */}
                <div className="md:hidden space-y-3 mb-4">
                    {incidents.map((incident) => (
                        <div key={`incident-card-${incident.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-2.5">
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                                <div>
                                    <span className="font-bold text-sm text-red-600 dark:text-red-400">
                                        {t(incident.type)}
                                    </span>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Clock size={11} />
                                        <span>{incident.date ? new Date(incident.date).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    incident.status === 'Resolved' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300' 
                                    : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                                }`}>
                                    {t(incident.status)}
                                </span>
                            </div>

                            <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3">
                                {incident.description}
                            </p>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <span>Reported by:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {incident.reporterName || t('Anonymous')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                <Table headers={[t('Type'), t('Description'), t('Reported By'), t('Date'), t('Status')]}>
                    {incidents.map((incident) => (
                        <tr key={incident.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4">
                                <span className="font-bold text-red-600 dark:text-red-400">{t(incident.type)}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate">
                                {incident.description}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                {incident.reporterName || t('Anonymous')}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500 flex items-center gap-1">
                                <Clock size={14} /> {incident.date ? new Date(incident.date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    incident.status === 'Resolved' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                    {t(incident.status)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </Table>
                </div>
                </>
            ) : (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                    <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">
                        {t("All Clear!")}
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400">
                        {t("There hasn't been any hazard reports, all is safe.")}
                    </p>
                </div>
            )}
        </Card>
    );
};

export default IncidentsTab;
