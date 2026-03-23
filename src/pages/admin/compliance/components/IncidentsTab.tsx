
import React from 'react';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Table from '../../../../components/ui/Table';
import type { IncidentReport } from '../../../../types/types';

interface IncidentsTabProps {
    incidents: IncidentReport[];
}

const IncidentsTab: React.FC<IncidentsTabProps> = ({ incidents }) => {
    return (
        <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="text-red-500" /> Safety & Hazard Reports
                </h3>
            </div>

            {incidents.length > 0 ? (
                <Table headers={['Type', 'Description', 'Reported By', 'Date', 'Status']}>
                    {incidents.map((incident) => (
                        <tr key={incident.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4">
                                <span className="font-bold text-red-600 dark:text-red-400">{incident.type}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate">
                                {incident.description}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                {incident.reporterName || 'Anonymous'}
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
                                    {incident.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </Table>
            ) : (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                    <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">
                        All Clear!
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400">
                        There hasn't been any hazard reports, all is safe.
                    </p>
                </div>
            )}
        </Card>
    );
};

export default IncidentsTab;
