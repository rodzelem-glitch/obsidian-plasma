import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";
import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { db } from 'lib/firebase';
import { globalConfirm } from 'lib/globalConfirm';
import Card from 'components/ui/Card';
import type { ShiftLog, ShiftEdit, User } from 'types';
import EmployeeSelector from './timesheets/components/EmployeeSelector';
import TimesheetTable from './timesheets/components/TimesheetTable';
import EditShiftModal from './timesheets/components/EditShiftModal';
import PayrollPreviewModal from './timesheets/components/PayrollPreviewModal';
import { useNavigate } from 'react-router-dom';
import { Monitor, Download, AlertTriangle } from 'lucide-react';
import { usePayrollService } from 'hooks/usePayrollService';
import { detectTimeDiscrepancies } from 'lib/timeDiscrepancy';
import JobDiscrepancyModal from 'components/modals/JobDiscrepancyModal';

const TimeSheetReview: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const { activePayrollService } = usePayrollService();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [editingLog, setEditingLog] = useState<ShiftLog | null>(null);
    const [isDiscrepancyModalOpen, setIsDiscrepancyModalOpen] = useState<boolean>(false);
    const currentUser = state.currentUser;
    const navigate = useNavigate();

    const discrepancies = useMemo(() => {
        return detectTimeDiscrepancies(state.jobs || [], state.shiftLogs || {}, state.users || []);
    }, [state.jobs, state.shiftLogs, state.users]);

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
            await db.collection('shiftLogs').doc(log.id).update(cleanUndefinedFields({ isApproved: true }));
            dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: selectedEmployeeId, log: { ...log, isApproved: true } } });
            
            // Automated PTO Accrual Policy Engine: automatically increments employee balance in real-time when timesheet is approved
            const employee = state.users.find(u => u.id === selectedEmployeeId);
            if (employee && employee.ptoAccrualRate && employee.ptoAccrualRate > 0 && !log.isApproved) {
                const clockInTime = new Date(log.clockIn).getTime();
                const clockOutTime = log.clockOut ? new Date(log.clockOut).getTime() : Date.now();
                const durationHrs = Math.max(0, (clockOutTime - clockInTime) / (1000 * 60 * 60));
                
                const ptoAccruedThisShift = durationHrs * employee.ptoAccrualRate;
                const newPtoTotal = Number((Number(employee.ptoAccrued || 0) + ptoAccruedThisShift).toFixed(4));
                
                const isSub = employee.id.startsWith('sub-') || employee.role?.toLowerCase() === 'subcontractor';
                const collectionName = isSub ? 'subcontractors' : 'users';
                
                await db.collection(collectionName).doc(employee.id).update(cleanUndefinedFields({
                    ptoAccrued: newPtoTotal
                }));
                
                dispatch({
                    type: 'UPDATE_EMPLOYEE',
                    payload: { ...employee, ptoAccrued: newPtoTotal } as any
                });
                
                showToast.success(`Automated PTO Policy: Accrued +${ptoAccruedThisShift.toFixed(2)} hrs PTO for this approved shift!`);
            }
        } catch (error) {
            console.error("Failed to approve shift", error);
            showToast.warn("Failed to save approval to the database.");
        }
    };

    const handleSaveEdit = async (updatedLog: ShiftLog, _editRecord: ShiftEdit) => {
        if (!selectedEmployeeId) return;
        try {
            const { id, ...updateData } = updatedLog;
            await db.collection('shiftLogs').doc(id).update(cleanUndefinedFields(updateData));
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

    const handleDirectExport = () => {
        if (!payrollStartDate || !payrollEndDate) return;

        const combinedUsers = [...(state.users || []), ...(state.subcontractors || [])];
        const records: Record<string, { userId: string, name: string, gustoId: string, adpId: string, regularHours: number, overtime: number, commission: number }> = {};

        // Aggregate Hours
        Object.entries(state.shiftLogs || {}).forEach(([userId, logsMap]) => {
            const logs = Array.isArray(logsMap) ? logsMap : [];
            logs.forEach((log: any) => {
                if (log.isApproved && log.clockIn && log.clockOut) {
                    const clockInDate = log.clockIn.split('T')[0];
                    if (clockInDate >= payrollStartDate && clockInDate <= payrollEndDate) {
                        if (!records[userId]) {
                            const user: any = combinedUsers.find(u => u.id === userId);
                            records[userId] = {
                                userId,
                                name: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
                                gustoId: user?.gustoEmployeeId || '',
                                adpId: user?.adpEmployeeId || '',
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
            if (job.status === 'closed' && job.completedDate && job.completedDate >= payrollStartDate && job.completedDate <= payrollEndDate && job.commissionAwarded) {
                const techId = job.assignedTechnicianId || job.technicianId;
                if (techId) {
                    if (!records[techId]) {
                        const user: any = combinedUsers.find(u => u.id === techId);
                        records[techId] = {
                            userId: techId,
                            name: user ? `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() || 'Unknown' : 'Unknown',
                            gustoId: user?.gustoEmployeeId || '',
                            adpId: user?.adpEmployeeId || '',
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
        if (allRecords.length === 0) {
            showToast.warn("No approved timesheets or jobs found in this date range.");
            return;
        }

        let headers: string[] = [];
        let rows: any[][] = [];

        if (activePayrollService === 'gusto') {
            headers = [
                'last_name', 'first_name', 'title', 'gusto_employee_id',
                'regular_hours', 'overtime_hours', 'double_overtime_hours',
                'missed_break_hours', 'bonus', 'commission', 'paycheck_tips',
                'cash_tips', 'correction', 'reimbursement', 'personal_note'
            ];
            rows = allRecords.map(row => {
                const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                return [
                    user?.lastName || '',
                    user?.firstName || user?.name || '',
                    user?.title || (user?.role ? user.role.replace('_', ' ') : 'Technician'),
                    user?.gustoEmployeeId || '',
                    row.regularHours > 0 ? row.regularHours.toFixed(2) : '',
                    row.overtime > 0 ? row.overtime.toFixed(2) : '',
                    '', '', '',
                    row.commission > 0 ? row.commission.toFixed(2) : '',
                    '', '', '', '', ''
                ];
            });
        } else if (activePayrollService === 'quickbooks') {
            headers = ['Employee Name', 'Start Date', 'End Date', 'Regular Hours', 'Overtime Hours', 'Commission', 'Billing Rate', 'Service', 'Notes'];
            rows = allRecords.map(row => {
                const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                return [
                    row.name,
                    payrollStartDate,
                    payrollEndDate,
                    row.regularHours.toFixed(2),
                    row.overtime.toFixed(2),
                    row.commission > 0 ? row.commission.toFixed(2) : '0.00',
                    user?.billableRate || '0.00',
                    'Field Service',
                    'TekTrakker Timesheet Sync'
                ];
            });
        } else if (activePayrollService === 'adp') {
            headers = ['Company Code', 'Batch ID', 'File Number', 'Employee Name', 'Regular Hours', 'Overtime Hours', 'Earnings Code', 'Earnings Amount'];
            rows = allRecords.map(row => [
                'TEK',
                'PAYROLL',
                row.userId.substring(0, 6).toUpperCase(),
                row.name,
                row.regularHours.toFixed(2),
                row.overtime.toFixed(2),
                row.commission > 0 ? 'COMM' : '',
                row.commission > 0 ? row.commission.toFixed(2) : ''
            ]);
        } else if (activePayrollService === 'paychex') {
            headers = ['Employee ID', 'Employee Name', 'Regular Hours', 'Overtime Hours', 'Commission Amount'];
            rows = allRecords.map(row => [
                row.userId.substring(0, 8).toUpperCase(),
                row.name,
                row.regularHours.toFixed(2),
                row.overtime.toFixed(2),
                row.commission > 0 ? row.commission.toFixed(2) : '0.00'
            ]);
        } else {
            // Direct deposit manual formatting under Strategy 1 (Fallback Mode)
            let bankDetails: Record<string, any> = {};
            try {
                const cached = sessionStorage.getItem('tektrakker_staging_bank_details');
                if (cached) bankDetails = JSON.parse(cached);
            } catch (e) {
                console.error(e);
            }
            headers = [
                'Employee ID', 'Employee Name', 'Email', 
                'Routing Number', 'Account Number', 'Account Type', 
                'Regular Hours', 'Overtime Hours', 'Commission', 'Total Payout'
            ];
            rows = allRecords.map(row => {
                const user: any = (state.users || []).find((u: any) => u.id === row.userId);
                const rate = Number(user?.payRate) || 0;
                const uDetails = bankDetails[row.userId] || { routingNumber: '', accountNumber: '', accountType: 'checking' };
                return [
                    row.userId.substring(0, 8).toUpperCase(),
                    row.name,
                    user?.email || '',
                    uDetails.routingNumber || '',
                    uDetails.accountNumber || '',
                    uDetails.accountType || 'checking',
                    row.regularHours.toFixed(2),
                    row.overtime.toFixed(2),
                    row.commission.toFixed(2),
                    (row.regularHours * rate + row.commission).toFixed(2)
                ];
            });
        }

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => {
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `payroll_export_${activePayrollService}_${payrollStartDate}_to_${payrollEndDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast.success(`Direct payroll export downloaded successfully (${activePayrollService.toUpperCase()} format)!`);
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <button 
                        onClick={() => navigate('/admin/kiosk')} 
                        className="w-full md:w-auto justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-md border-b-4 border-indigo-800 active:translate-y-1 active:border-b-0 shrink-0"
                    >
                        <Monitor size={20} /> {t("Launch Front-Desk Kiosk")}
                    </button>

                    <div className="h-px md:h-10 w-full md:w-px bg-gray-200 dark:bg-gray-700 shrink-0" />

                    <div className="flex flex-col md:flex-row items-center gap-3 w-full">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 shrink-0">{t("From")}</span>
                            <input 
                                type="date" 
                                value={payrollStartDate} 
                                onChange={e => setPayrollStartDate(e.target.value)} 
                                className="w-full md:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 shrink-0">{t("To")}</span>
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
                            {t("Sync & Preview Payroll")}
                        </button>
                        <button
                            onClick={handleDirectExport}
                            disabled={!payrollStartDate || !payrollEndDate}
                            className="w-full md:w-auto justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shrink-0 border-b-4 border-blue-800 active:translate-y-1 active:border-b-0"
                        >
                            <Download size={20} /> {t("Export Payroll (CSV)")}
                        </button>
                        <button
                            onClick={() => setIsDiscrepancyModalOpen(true)}
                            className={`w-full md:w-auto justify-center px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md shrink-0 border-b-4 ${
                                discrepancies.length > 0
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-800'
                                    : 'bg-slate-700 hover:bg-slate-800 text-slate-200 border-slate-900'
                            }`}
                        >
                            <AlertTriangle size={18} /> {t("Time Audit")} {discrepancies.length > 0 ? `(${discrepancies.length})` : ''}
                        </button>
                    </div>
                </div>
            </header>

            {discrepancies.length > 0 && (
                <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl gap-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                        <div>
                            <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm md:text-base">
                                {discrepancies.length} Location & Job Time Discrepanc{discrepancies.length === 1 ? 'y' : 'ies'} Flagged
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                                Automated audit detected mismatches between physical shift clock-outs and reported technician job check-ins/outs.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsDiscrepancyModalOpen(true)}
                        className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                        <AlertTriangle size={16} /> Review & Fix Discrepancies ({discrepancies.length})
                    </button>
                </div>
            )}

            <JobDiscrepancyModal
                isOpen={isDiscrepancyModalOpen}
                onClose={() => setIsDiscrepancyModalOpen(false)}
                discrepancies={discrepancies}
            />

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
