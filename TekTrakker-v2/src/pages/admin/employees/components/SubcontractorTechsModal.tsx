import React, { useMemo } from 'react';
import Modal from '../../../../components/ui/Modal';
import Table from '../../../../components/ui/Table';
import { useAppContext } from '../../../../context/AppContext';
import type { User, Job } from '../../../../types';
import { Mail, Phone, MapPin, Activity, HardHat } from 'lucide-react';
import { formatAddress } from 'lib/utils';

interface SubcontractorTechsModalProps {
    isOpen: boolean;
    onClose: () => void;
    subcontractor: User;
}

const SubcontractorTechsModal: React.FC<SubcontractorTechsModalProps> = ({
    isOpen,
    onClose,
    subcontractor
}) => {
    const { state } = useAppContext();

    // 1. Get technicians under this subcontractor
    const techs = useMemo(() => {
        return state.users.filter(u => 
            u.subcontractorId === subcontractor.id || 
            u.reportsTo === subcontractor.id
        );
    }, [state.users, subcontractor.id]);

    // Helper to find the active job and what they are doing
    const getTechActiveJobAndStatus = (techId: string) => {
        // Search state.jobs for active job
        const activeJob = state.jobs.find(j => 
            j.assignedTechnicianId === techId && 
            j.jobStatus !== 'Completed' && 
            j.jobStatus !== 'Cancelled'
        );

        if (!activeJob) return { job: null, statusLabel: 'Idle', statusColor: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400' };

        let statusLabel = 'Scheduled';
        let statusColor = 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';

        if (activeJob.transitStartTime && !activeJob.checkInTime) {
            statusLabel = 'En Route';
            statusColor = 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400';
        } else if (activeJob.checkInTime) {
            statusLabel = 'On Site';
            statusColor = 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
        } else if (activeJob.jobStatus === 'Needs Follow-up') {
            statusLabel = 'Needs Follow-up';
            statusColor = 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
        }

        return { job: activeJob, statusLabel, statusColor };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Subcontractor Crew - ${subcontractor.firstName} ${subcontractor.lastName}`} size="xl">
            <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <HardHat size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200">{subcontractor.firstName} {subcontractor.lastName}</h4>
                        <p className="text-xs text-slate-500">{subcontractor.email} &bull; {subcontractor.phone || 'No phone'}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Technicians ({techs.length})</h3>
                    <p className="text-xs text-slate-550 dark:text-slate-400">Subcontractor's internal technicians. They are kept separated from the primary company employee list.</p>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <Table headers={['Technician', 'Status', 'Current Job Assignment', 'Location']}>
                        {techs.map(tech => {
                            const { job, statusLabel, statusColor } = getTechActiveJobAndStatus(tech.id);
                            const hasLocation = tech.location?.lat && tech.location?.lng;
                            
                            return (
                                <tr key={tech.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 dark:text-white">{tech.firstName} {tech.lastName}</div>
                                        <div className="text-xs text-slate-500 space-y-0.5 mt-1">
                                            <div className="flex items-center gap-1"><Mail size={12} /> {tech.email}</div>
                                            {tech.phone && <div className="flex items-center gap-1"><Phone size={12} /> {tech.phone}</div>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${statusColor}`}>
                                            <Activity size={12} /> {statusLabel}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-350">
                                        {job ? (
                                            <div className="space-y-1">
                                                <div className="font-bold text-indigo-600 dark:text-indigo-400">Job #{job.poNumber || job.id.slice(-6).toUpperCase()}</div>
                                                <div className="text-xs text-slate-550 dark:text-slate-450 font-medium truncate max-w-[200px]">{job.customerName}</div>
                                                <div className="text-[10px] text-slate-400 truncate max-w-[200px] flex items-center gap-0.5"><MapPin size={10} /> {formatAddress(job.address)}</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">None</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {hasLocation ? (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold text-slate-700 dark:text-slate-350 flex items-center gap-1"><MapPin size={12} className="text-emerald-500" /> Lat: {tech.location?.lat.toFixed(4)}</span>
                                                <span>Lng: {tech.location?.lng.toFixed(4)}</span>
                                                <span className="text-[10px] text-slate-400">Updated: {tech.lastLocationUpdate ? new Date(tech.lastLocationUpdate).toLocaleTimeString() : 'N/A'}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">No GPS signal</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {techs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/10">
                                    No technicians found in this subcontractor's crew.
                                </td>
                            </tr>
                        )}
                    </Table>
                </div>
            </div>
        </Modal>
    );
};

export default SubcontractorTechsModal;
