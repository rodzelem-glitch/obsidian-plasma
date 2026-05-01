import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import { globalConfirm } from 'lib/globalConfirm';
import Card from 'components/ui/Card';
import type { ShiftLog, ShiftEdit, User } from 'types';
import EmployeeSelector from './timesheets/components/EmployeeSelector';
import TimesheetTable from './timesheets/components/TimesheetTable';
import EditShiftModal from './timesheets/components/EditShiftModal';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';

const TimeSheetReview: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [editingLog, setEditingLog] = useState<ShiftLog | null>(null);
    const currentUser = state.currentUser;
    const navigate = useNavigate();

    const WORKFORCE_ROLES = new Set(['employee', 'both', 'supervisor', 'technician', 'subcontractor', 'admin']);
    const employees = useMemo(() => (state.users as User[]).filter(u => 
        u.organizationId === state.currentOrganization?.id &&
        WORKFORCE_ROLES.has((u.role || '').toLowerCase()) &&
        (currentUser?.role !== 'supervisor' || u.reportsTo === currentUser?.id || u.id === currentUser?.id)
    ), [state.users, state.currentOrganization, currentUser]);
    
    const employeeLogs = useMemo(() => {
        if (!selectedEmployeeId) return [];
        return (state.shiftLogs[selectedEmployeeId] || []).sort((a: ShiftLog, b: ShiftLog) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
    }, [selectedEmployeeId, state.shiftLogs]);

    const handleApprove = (log: ShiftLog) => {
        if (!selectedEmployeeId) return;
        dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: selectedEmployeeId, log: { ...log, isApproved: true } } });
    };

    const handleSaveEdit = async (updatedLog: ShiftLog, editRecord: ShiftEdit) => {
        if (!selectedEmployeeId) return;
        try {
            const { id, ...updateData } = updatedLog;
            await db.collection('shiftLogs').doc(id).update(updateData);
            dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: selectedEmployeeId, log: updatedLog } });
        } catch (error) {
            console.error("Failed to save shift edit", error);
            alert("Failed to save changes to the database.");
        }
    };

    const handleDelete = async (log: ShiftLog) => {
        const confirmed = await globalConfirm('Are you sure you want to permanently delete this shift log? This cannot be undone.', 'Delete Shift');
        if (confirmed) {
            await db.collection('shiftLogs').doc(log.id).delete();
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Time Sheet Review</h2>
                    <p className="text-gray-600 dark:text-gray-400">Adjust employee hours, view shift history, or launch Office Kiosk.</p>
                </div>
                <button 
                    onClick={() => navigate('/admin/kiosk')} 
                    className="w-full md:w-auto justify-center bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-md border-b-4 border-primary-800 active:translate-y-1 active:border-b-0"
                >
                    <Monitor size={20} /> Launch Front-Desk Kiosk
                </button>
            </header>

            <EditShiftModal 
                log={editingLog}
                onClose={() => setEditingLog(null)}
                onSave={handleSaveEdit}
                currentUser={currentUser}
            />

            <Card>
                <EmployeeSelector 
                    employees={employees}
                    selectedEmployeeId={selectedEmployeeId}
                    setSelectedEmployeeId={setSelectedEmployeeId}
                />

                {selectedEmployeeId && (
                    <TimesheetTable
                        logs={employeeLogs}
                        handleApprove={handleApprove}
                        handleEditClick={(log) => setEditingLog(log)}
                        handleDeleteClick={handleDelete}
                    />
                )}
            </Card>
        </div>
    );
};

export default TimeSheetReview;
