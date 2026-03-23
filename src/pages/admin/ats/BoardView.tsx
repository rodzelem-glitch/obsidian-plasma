
import React from 'react';
import type { Applicant } from 'types';

interface BoardViewProps {
    applicants: Applicant[];
    onSelectApplicant: (applicant: Applicant) => void;
    statusCols: string[];
    statusColors: Record<string, string>;
}

const BoardView: React.FC<BoardViewProps> = ({ applicants, onSelectApplicant, statusCols, statusColors }) => {
    return (
        <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-[1200px] h-full">
                {statusCols.map(status => (
                    <div key={status} className="flex-1 bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 flex flex-col min-w-[200px]">
                        <h3 className={`font-bold text-xs uppercase tracking-wider mb-3 flex justify-between items-center px-2 py-1 rounded border ${statusColors[status]}`}>
                            {status} 
                            <span className="bg-white/50 dark:bg-black/20 px-2 rounded-full text-xs">
                                {applicants.filter(a => a.status === status).length}
                            </span>
                        </h3>
                        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                            {applicants.filter(a => a.status === status).map(app => (
                                <div key={app.id} onClick={() => onSelectApplicant(app)} className="bg-white dark:bg-gray-700 p-3 rounded-md shadow-sm border border-gray-200 dark:border-gray-600 cursor-pointer hover:shadow-md transition-shadow">
                                    <p className="font-bold text-sm text-gray-900 dark:text-white">{app.name || `${app.firstName} ${app.lastName}`}</p>
                                    <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">{app.position}</p>
                                    <p className="text-[11px] text-gray-400 mt-2 text-right">
                                        Applied: {app.applicationDate ? new Date(app.applicationDate).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BoardView;
