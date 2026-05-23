import showToast from "lib/toast";
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import { globalConfirm } from 'lib/globalConfirm';
import Card from 'components/ui/Card';
import type { ShiftLog, ShiftEdit, User } from 'types';
import EmployeeSelector from './timesheets/components/EmployeeSelector';
import TimesheetTable from './timesheets/components/TimesheetTable';
import EditShiftModal from './timesheets/components/EditShiftModal';
import PayrollPreviewModal from './timesheets/components/PayrollPreviewModal';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';

const TimeSheetReview: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [editingLog, setEditingLog] = useState<ShiftLog | null>(null);
    const currentUser = state.currentUser;
    const navigate = useNavigate();

    const getFirstDayOfMonth = () => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    };
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    const [payrollStartDate, setPayrollStartDate] = useState<string>(getFirstDayOfMonth());
    const [payrollEndDate, setPayrollEndDate] = useState<string>(getTodayDate());
    const [isPayrollModalOpen, setIsPayrollModalOpen] = useState<boolean>(false);

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

    const handleApprove = async (log: ShiftLog) => {
        if (!selectedEmployeeId) return;
        try {
            await db.collection('shiftLogs').doc(log.id).update({ isApproved: true });
            dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: selectedEmployeeId, log: { ...log, isApproved: true } } });
        } catch (error) {
            console.error("Failed to approve shift", error);
            showToast.warn("Failed to save approval to the database.");
        }
    };

    const handleSaveEdit = async (updatedLog: ShiftLog, _editRecord: ShiftEdit) => {
        if (!selectedEmployeeId) return;
        try {
            const { id, ...updateData } = updatedLog;
            await db.collection('shiftLogs').doc(id).update(updateData);
            dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: selectedEmployeeId, log: updatedLog } });
        } catch (error) {
            console.error("Failed to save shift edit", error);
            showToast.warn("Failed to save changes to the database.");
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
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <button 
                        onClick={() => navigate('/admin/kiosk')} 
                        className="w-full md:w-auto justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-md border-b-4 border-indigo-800 active:translate-y-1 active:border-b-0 shrink-0"
                    >
                        <Monitor size={20} /> Launch Front-Desk Kiosk
                    </button>

                    <div className="h-px md:h-10 w-full md:w-px bg-gray-200 dark:bg-gray-700 shrink-0" />

                    <div className="flex flex-col md:flex-row items-center gap-3 w-full">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 shrink-0">From</span>
                            <input 
                                type="date" 
                                value={payrollStartDate} 
                                onChange={e => setPayrollStartDate(e.target.value)} 
                                className="w-full md:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 shrink-0">To</span>
                            <input 
                                type="date" 
                                value={payrollEndDate} 
                                onChange={e => setPayrollEndDate(e.target.value)} 
                                className="w-full md:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                            />
                        </div>
                        <button
                            onClick={() => setIsPayrollModalOpen(true)}
                            disabled={!payrollStartDate || !payrollEndDate}
                            className="w-full md:w-auto justify-center bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shrink-0 border-b-4 border-emerald-800 active:translate-y-1 active:border-b-0"
                        >
                            Sync & Preview Payroll
                        </button>
                    </div>
                </div>
            </header>

            <PayrollPreviewModal 
                isOpen={isPayrollModalOpen}
                onClose={() => setIsPayrollModalOpen(false)}
                startDate={payrollStartDate}
                endDate={payrollEndDate}
            />

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
