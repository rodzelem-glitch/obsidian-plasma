import showToast from "lib/toast";
import React, { useMemo } from 'react';
import { X, PlayCircle, Loader2 } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface PayrollPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    startDate: string;
    endDate: string;
}

const PayrollPreviewModal: React.FC<PayrollPreviewModalProps> = ({ isOpen, onClose, startDate, endDate }) => {
    const { state } = useAppContext();
    const [isStaging, setIsStaging] = React.useState(false);
    const [error, setError] = React.useState('');

    const compensationTable = useMemo(() => {
        if (!isOpen) return { valid: [], unsynced: [] };

        const records: Record<string, { userId: string, name: string, gustoId: string, regularHours: number, overtime: number, commission: number }> = {};

        // Aggregate Hours
        Object.entries(state.shiftLogs || {}).forEach(([userId, logsMap]) => {
            const logs = Array.isArray(logsMap) ? logsMap : [];
            logs.forEach((log: any) => {
                if (log.isApproved && log.clockIn && log.clockOut) {
                    const clockInDate = log.clockIn.split('T')[0];
                    if (clockInDate >= startDate && clockInDate <= endDate) {
                        if (!records[userId]) {
                            const user: any = state.users.find(u => u.id === userId);
                            records[userId] = {
                                userId,
                                name: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
                                gustoId: user?.gustoEmployeeId || '',
                                regularHours: 0,
                                overtime: 0,
                                commission: 0
                            };
                        }
                        const diffHours = (new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / 3600000;
                        let regular = diffHours;
                        let overtime = 0;
                        if (diffHours > 8) {
                            regular = 8;
                            overtime = diffHours - 8;
                        }
                        records[userId].regularHours += regular;
                        records[userId].overtime += overtime;
                    }
                }
            });
        });

        // Aggregate Commissions
        (state.jobs || []).forEach((job: any) => {
            if (job.status === 'closed' && job.completedDate && job.completedDate >= startDate && job.completedDate <= endDate && job.commissionAwarded) {
                const techId = job.assignedTechnicianId || job.technicianId;
                if (techId) {
                    if (!records[techId]) {
                        const user: any = state.users.find(u => u.id === techId);
                        records[techId] = {
                            userId: techId,
                            name: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
                            gustoId: user?.gustoEmployeeId || '',
                            regularHours: 0,
                            overtime: 0,
                            commission: 0
                        };
                    }
                    records[techId].commission += Number(job.commissionAwarded);
                }
            }
        });

        const allRecords = Object.values(records);
        return {
            valid: allRecords.filter(r => r.gustoId),
            unsynced: allRecords.filter(r => !r.gustoId)
        };
    }, [isOpen, state.shiftLogs, state.jobs, state.users, startDate, endDate]);

    const handleStage = async () => {
        if (!state.currentOrganization?.id) return;
        setIsStaging(true);
        setError('');
        try {
            const functions = getFunctions();
            const stageReq = httpsCallable(functions, 'stageGustoPayroll');
            const res = await stageReq({ orgId: state.currentOrganization.id, startDate, endDate });
            const data = res.data as any;
            if (data.success) {
                window.open(data.gustoReviewUrl, '_blank');
                onClose();
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsStaging(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 px-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Gusto Payroll Preview ({startDate} to {endDate})
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-700 transition" title="Close Preview" aria-label="Close Preview">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {compensationTable.unsynced.length > 0 && (
                        <div className="mb-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-xl p-5 shadow-sm">
                            <h3 className="text-amber-800 dark:text-amber-300 font-bold mb-2 flex items-center gap-2">
                                <Loader2 className="w-5 h-5" /> Pending Gusto Sync
                            </h3>
                            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                                The following team members have billable work in this period, but their profiles haven't been mirrored to Gusto yet.
                            </p>
                            <ul className="list-disc pl-5 text-sm font-medium text-amber-900 dark:text-amber-100 grid grid-cols-2 gap-1 mb-4">
                                {compensationTable.unsynced.map(u => <li key={u.userId}>{u.name}</li>)}
                            </ul>
                            <button 
                                onClick={async () => {
                                    setIsStaging(true);
                                    try {
                                        const functions = getFunctions();
                                        const syncReq = httpsCallable(functions, 'bulkSyncMissingEmployees');
                                        await syncReq({ orgId: state.currentOrganization?.id, userIds: compensationTable.unsynced.map(u => u.userId) });
                                        showToast.warn("Successfully synced missing employees! Please close and reopen the modal to refresh the table.");
                                    } catch (e: any) { showToast.warn("Failed to blast sync: " + e.message); }
                                    setIsStaging(false);
                                }}
                                disabled={isStaging}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-bold shadow transition-colors text-sm"
                            >
                                {isStaging ? 'Syncing with Gusto...' : 'Force Sync Missing Profiles'}
                            </button>
                        </div>
                    )}

                    {compensationTable.valid.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No fully synced timesheets or jobs found in this date range.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Hrs</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime Hrs</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {compensationTable.valid.map((row) => (
                                        <tr key={row.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{row.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row.regularHours.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row.overtime.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 dark:text-emerald-400 font-bold">${row.commission.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                            Failed to stage payroll: {error}
                        </div>
                    )}
                </div>

                <div className="p-4 px-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleStage}
                        disabled={compensationTable.valid.length === 0 || isStaging}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    >
                        {isStaging ? <><Loader2 className="animate-spin" size={18} /> Syncing with Gusto...</> : <><PlayCircle size={18} /> Confirm & Stage in Gusto Sandbox</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayrollPreviewModal;
