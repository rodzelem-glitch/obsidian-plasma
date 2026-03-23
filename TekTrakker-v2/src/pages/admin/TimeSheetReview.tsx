import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import type { ShiftLog, ShiftEdit, User } from 'types';
import EmployeeSelector from './timesheets/components/EmployeeSelector';
import TimesheetTable from './timesheets/components/TimesheetTable';
import EditShiftModal from './timesheets/components/EditShiftModal';

const TimeSheetReview: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [editingLog, setEditingLog] = useState<ShiftLog | null>(null);
    const currentUser = state.currentUser;

    const employees = useMemo(() => (state.users as User[]).filter(u => 
        u.organizationId === state.currentOrganization?.id &&
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor') &&
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

    const handleSaveEdit = (updatedLog: ShiftLog, editRecord: ShiftEdit) => {
        if (!selectedEmployeeId) return;
        dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: selectedEmployeeId, log: updatedLog } });
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Time Sheet Review</h2>
                <p className="text-gray-600 dark:text-gray-400">Adjust employee hours and view shift history.</p>
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
                    />
                )}
            </Card>
        </div>
    );
};

export default TimeSheetReview;
