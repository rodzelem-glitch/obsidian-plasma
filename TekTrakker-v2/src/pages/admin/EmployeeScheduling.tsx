import React, { useState, useMemo } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import type { WorkSchedule } from 'types';
import EmployeeSelector from './employees/components/EmployeeSelector';
import ScheduleTable from './employees/components/ScheduleTable';
import { db } from 'lib/firebase';

const EmployeeScheduling: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [selectedUserId, setSelectedUserId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const currentUser = state.currentUser;
    
    const WORKFORCE_ROLES = new Set(['employee', 'both', 'supervisor', 'technician', 'subcontractor', 'admin']);
    const employees = useMemo(() => state.users.filter(u => 
        u.organizationId === state.currentOrganization?.id &&
        WORKFORCE_ROLES.has((u.role || '').toLowerCase()) &&
        (currentUser?.role !== 'supervisor' || u.reportsTo === currentUser?.id || u.id === currentUser?.id)
    ), [state.users, state.currentOrganization, currentUser]);

    const userSchedules = useMemo(() => state.schedules.filter(s => s.userId === selectedUserId), [state.schedules, selectedUserId]);

    const handleScheduleUpdate = async (dayIndex: number, field: keyof WorkSchedule, value: any) => {
        if (!selectedUserId || !state.currentOrganization?.id) return;
        
        const existingSchedule = userSchedules.find(s => s.dayOfWeek === dayIndex);
        let newSchedule: WorkSchedule;
        
        if (existingSchedule) {
            newSchedule = { ...existingSchedule, [field]: value };
        } else {
            newSchedule = {
                id: `sched-${Date.now()}-${dayIndex}`,
                organizationId: state.currentOrganization.id,
                userId: selectedUserId,
                dayOfWeek: dayIndex,
                startTime: '08:00',
                endTime: '17:00',
                isOff: false,
                [field]: value
            };
        }

        try {
            setIsSaving(true);
            // FIXED: Use 'workSchedules' to match AppContext subscription
            await db.collection('workSchedules').doc(newSchedule.id).set(newSchedule, { merge: true });
            dispatch({ type: 'UPDATE_SCHEDULE', payload: newSchedule });
        } catch (error) {
            console.error("Failed to update schedule:", error);
            alert("Permission denied or failed to save schedule.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Employee Scheduling</h2>
                <p className="text-gray-600 dark:text-gray-400">Set weekly availability.</p>
            </header>
            <Card>
                <EmployeeSelector 
                    employees={employees}
                    selectedUserId={selectedUserId}
                    onSelect={setSelectedUserId}
                />
                {selectedUserId && (
                    <div className={isSaving ? 'opacity-50 pointer-events-none' : ''}>
                        <ScheduleTable 
                            schedules={userSchedules}
                            onUpdate={handleScheduleUpdate}
                        />
                        {isSaving && <p className="text-center text-xs text-primary-600 font-bold mt-2 animate-pulse">Saving changes...</p>}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default EmployeeScheduling;
