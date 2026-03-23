
import React from 'react';
import Card from 'components/ui/Card';
import { Clock } from 'lucide-react';
import { User } from 'types';

interface TechListProps {
    techs: any[];
    onTechSelect: (tech: any) => void;
}

const TechList: React.FC<TechListProps> = ({ techs, onTechSelect }) => {
    return (
        <div className="w-full lg:w-1/3 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {techs.map((tech: any) => (
                <Card 
                    key={tech.id} 
                    onClick={() => onTechSelect(tech)}
                    className={`border-l-4 ${tech.isOnline ? 'border-green-500' : 'border-gray-400'} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer`}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${tech.isOnline ? 'bg-green-600' : 'bg-gray-400'}`}>
                                {tech.firstName ? tech.firstName[0] : 'T'}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">{tech.firstName} {tech.lastName}</h3>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock size={12}/> {tech.hasLocation ? `Updated ${Math.floor(tech.diffMins)}m ago` : 'Location Unknown'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${tech.activeJob ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {tech.activeJob ? 'On Job' : 'Idle'}
                            </span>
                        </div>
                    </div>
                    
                    {tech.activeJob && (
                        <div className="mt-3 bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs">
                            <p className="font-bold text-gray-800 dark:text-gray-200">Current: {tech.activeJob.customerName}</p>
                            <p className="text-gray-500 dark:text-gray-400 truncate">{tech.activeJob.address}</p>
                        </div>
                    )}
                </Card>
            ))}
            {techs.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    No technicians found for tracking.
                </div>
            )}
        </div>
    );
};

export default TechList;
