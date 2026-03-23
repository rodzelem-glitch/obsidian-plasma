
import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import Card from '../../../../components/ui/Card';

const IncidentQueue: React.FC<{ incidents: any[], onViewIncident: (incident: any) => void }> = ({ incidents, onViewIncident }) => {

    return (
        <Card className="p-4 sm:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Incident Queue</h3>
            <div className="space-y-3">
                {incidents.length > 0 ? incidents.map(incident => (
                    <div 
                        key={incident.id} 
                        onClick={() => onViewIncident(incident)}
                        className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
                    >
                        <div className="flex justify-between items-start">
                            <p className="font-bold text-sm text-red-600 dark:text-red-400">{incident.type}</p>
                            <span className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 font-bold px-2 py-0.5 rounded-full border border-red-600/20">{incident.status}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{incident.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
                            <Clock size={12} />
                            <span>{new Date(incident.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-4 md:py-8">
                        <p className="font-medium text-gray-500">No open incidents.</p>
                        <p className="text-sm text-gray-400">Good job, team!</p>
                    </div>
                )}
            </div>
        </Card>
    )
}

export default IncidentQueue
