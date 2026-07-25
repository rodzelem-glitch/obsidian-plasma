import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import { AlertTriangle, CheckCircle2, Clock, MapPin, RefreshCw } from 'lucide-react';
import type { JobDiscrepancy } from 'lib/timeDiscrepancy';

interface JobDiscrepancyModalProps {
    isOpen: boolean;
    onClose: () => void;
    discrepancies: JobDiscrepancy[];
}

const JobDiscrepancyModal: React.FC<JobDiscrepancyModalProps> = ({
    isOpen,
    onClose,
    discrepancies: initialDiscrepancies
}) => {
    const { state, dispatch } = useAppContext();
    const [discrepancies, setDiscrepancies] = useState<JobDiscrepancy[]>(initialDiscrepancies);
    const [fixingJobId, setFixingJobId] = useState<string | null>(null);
    const [isFixingAll, setIsFixingAll] = useState(false);

    // Sync state if initialDiscrepancies changes
    React.useEffect(() => {
        setDiscrepancies(initialDiscrepancies);
    }, [initialDiscrepancies]);

    const handleSyncToShiftEnd = async (discrepancy: JobDiscrepancy) => {
        if (!discrepancy.suggestedCheckOut) {
            showToast.warn("No suggested shift end time available to sync.");
            return;
        }

        setFixingJobId(discrepancy.jobId);
        try {
            const updatePayload: any = {
                checkOutTime: discrepancy.suggestedCheckOut,
                updatedAt: new Date().toISOString()
            };

            if (discrepancy.suggestedTimeOnSiteMinutes) {
                updatePayload.timeOnSiteMinutes = discrepancy.suggestedTimeOnSiteMinutes;
            }

            // Update Firestore
            await db.collection('jobs').doc(discrepancy.jobId).update(cleanUndefinedFields(updatePayload));

            // Update local state
            const targetJob = state.jobs.find(j => j.id === discrepancy.jobId);
            if (targetJob) {
                dispatch({
                    type: 'UPDATE_JOB',
                    payload: { ...targetJob, ...updatePayload }
                });
            }

            // Remove fixed discrepancy from modal state
            setDiscrepancies(prev => prev.filter(d => d.jobId !== discrepancy.jobId));
            showToast.success(`Successfully corrected check-out time for ${discrepancy.customerName}'s job!`);
        } catch (err: any) {
            console.error("Failed to sync job check-out time:", err);
            showToast.error("Failed to update job time: " + (err.message || 'Error occurred'));
        } finally {
            setFixingJobId(null);
        }
    };

    const handleFixAll = async () => {
        const fixable = discrepancies.filter(d => d.suggestedCheckOut);
        if (fixable.length === 0) {
            showToast.warn("No fixable discrepancies found.");
            return;
        }

        setIsFixingAll(true);
        let successCount = 0;

        for (const disc of fixable) {
            try {
                const updatePayload: any = {
                    checkOutTime: disc.suggestedCheckOut,
                    updatedAt: new Date().toISOString()
                };
                if (disc.suggestedTimeOnSiteMinutes) {
                    updatePayload.timeOnSiteMinutes = disc.suggestedTimeOnSiteMinutes;
                }

                await db.collection('jobs').doc(disc.jobId).update(cleanUndefinedFields(updatePayload));

                const targetJob = state.jobs.find(j => j.id === disc.jobId);
                if (targetJob) {
                    dispatch({
                        type: 'UPDATE_JOB',
                        payload: { ...targetJob, ...updatePayload }
                    });
                }
                successCount++;
            } catch (err) {
                console.error(`Failed to auto-fix job ${disc.jobId}`, err);
            }
        }

        setIsFixingAll(false);
        setDiscrepancies([]);
        showToast.success(`Successfully fixed ${successCount} job time discrepancies!`);
        onClose();
    };

    const handleDismiss = (jobId: string) => {
        setDiscrepancies(prev => prev.filter(d => d.jobId !== jobId));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Location & Job Time Audit Alerts"
            size="xl"
        >
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl gap-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={24} />
                        <div>
                            <h4 className="font-bold text-amber-300 text-sm md:text-base">
                                {discrepancies.length} Time & Location Discrepanc{discrepancies.length === 1 ? 'y' : 'ies'} Detected
                            </h4>
                            <p className="text-xs text-slate-300 mt-1">
                                Automated comparison between reported technician job check-ins/outs and actual physical shift location logs.
                            </p>
                        </div>
                    </div>
                    {discrepancies.some(d => d.suggestedCheckOut) && (
                        <Button
                            variant="primary"
                            onClick={handleFixAll}
                            disabled={isFixingAll}
                            className="w-full md:w-auto text-xs shrink-0 flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} className={isFixingAll ? 'animate-spin' : ''} />
                            {isFixingAll ? 'Fixing All...' : 'Auto-Sync All to Shift End'}
                        </Button>
                    )}
                </div>

                {discrepancies.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/40 rounded-xl border border-slate-700/50">
                        <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-3" />
                        <h4 className="text-lg font-bold text-white">All Job Times Verified</h4>
                        <p className="text-xs text-slate-400 mt-1">
                            No discrepancies found between technician job check-outs and physical shift logs.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {discrepancies.map((disc) => (
                            <div
                                key={disc.jobId}
                                className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 transition-all hover:border-slate-600"
                            >
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700/60 pb-3 mb-3">
                                    <div>
                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 mb-2">
                                            {disc.discrepancyType.replace(/_/g, ' ')}
                                        </span>
                                        <h4 className="font-bold text-white text-base">
                                            {disc.customerName}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                            <MapPin size={12} className="text-slate-500" />
                                            <span>{disc.customerAddress}</span>
                                        </div>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <span className="text-xs text-slate-400">Assigned Technician:</span>
                                        <p className="font-bold text-blue-400 text-sm">{disc.technicianName}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800 mb-4">
                                    <div>
                                        <p className="text-slate-400 font-semibold mb-1 flex items-center gap-1">
                                            <Clock size={12} className="text-amber-400" /> Job Check-In / Out (Reported):
                                        </p>
                                        <p className="text-slate-200">
                                            <span className="text-slate-400">In:</span> {disc.reportedCheckIn ? new Date(disc.reportedCheckIn).toLocaleString() : 'N/A'}
                                        </p>
                                        <p className="text-slate-200">
                                            <span className="text-slate-400">Out:</span> {disc.reportedCheckOut ? new Date(disc.reportedCheckOut).toLocaleString() : 'Open / Unclosed'}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-slate-400 font-semibold mb-1 flex items-center gap-1">
                                            <Clock size={12} className="text-emerald-400" /> Actual Shift Log (Physical):
                                        </p>
                                        <p className="text-slate-200">
                                            <span className="text-slate-400">Clock In:</span> {disc.shiftClockIn ? new Date(disc.shiftClockIn).toLocaleString() : 'No Shift Log'}
                                        </p>
                                        <p className="text-slate-200">
                                            <span className="text-slate-400">Clock Out:</span> {disc.shiftClockOut ? new Date(disc.shiftClockOut).toLocaleString() : 'Still Active'}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-xs text-amber-300 font-medium mb-4 flex items-center gap-1.5">
                                    <AlertTriangle size={14} className="shrink-0" />
                                    {disc.description}
                                </p>

                                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-700/60">
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleDismiss(disc.jobId)}
                                        className="text-xs"
                                    >
                                        Dismiss Alert
                                    </Button>
                                    {disc.suggestedCheckOut && (
                                        <Button
                                            variant="primary"
                                            onClick={() => handleSyncToShiftEnd(disc)}
                                            disabled={fixingJobId === disc.jobId}
                                            className="text-xs flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 size={14} />
                                            {fixingJobId === disc.jobId ? 'Correcting...' : `Sync Check-Out to Shift End (${new Date(disc.suggestedCheckOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default JobDiscrepancyModal;
