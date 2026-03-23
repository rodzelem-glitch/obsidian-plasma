
import React from 'react';
import type { Job } from '../../../../types/types';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, User, ArrowRight } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import { formatAddress } from '../../../../lib/utils';

const LiveOperations: React.FC<{ liveOps: Job[] }> = ({ liveOps }) => {
    const navigate = useNavigate();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'In Progress':
                return 'bg-blue-500';
            case 'Scheduled':
                return 'bg-yellow-500';
            default:
                return 'bg-gray-500';
        }
    };

    return (
        <Card className="p-4 sm:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight">Live Operations</h3>
                <button 
                    onClick={() => navigate('/admin/operations')}
                    className="flex items-center gap-2 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                >
                    Go to Dispatch <ArrowRight size={14} />
                </button>
            </div>
            <div className="space-y-4">
                {liveOps.length > 0 ? liveOps.map(job => (
                    <div key={job.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">{job.customerName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{job.tasks.join(', ')}</p>
                            </div>
                            <div className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${getStatusColor(job.jobStatus)}`}>
                                {job.jobStatus}
                            </div>
                        </div>
                        <div className="mt-2 text-xs space-y-1.5">
                             <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <User size={14} className="text-gray-400 flex-shrink-0" />
                                <span>{job.assignedTechnicianName || 'Unassigned'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                                <span>{formatAddress(job.address)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                <Clock size={14} className="text-gray-400 flex-shrink-0" />
                                <span>{new Date(job.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-4 md:py-8">
                        <p className="font-medium text-gray-500">No current operations.</p>
                        <p className="text-sm text-gray-400">Jobs will appear here when they are in progress or near their appointment time.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default LiveOperations;
