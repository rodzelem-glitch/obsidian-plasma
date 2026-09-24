
import React from 'react';
import type { WorkSchedule } from 'types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ScheduleTableProps {
    schedules: WorkSchedule[];
    onUpdate: (dayIndex: number, field: keyof WorkSchedule, value: any) => void;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ schedules, onUpdate }) => {
    return (
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="min-w-full border-separate border-spacing-0 divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-xs border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Day</th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Start Time</th>
                        <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">End Time</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {DAYS.map((day, index) => {
                        const sched = schedules.find(s => s.dayOfWeek === index);
                        const isOff = sched ? sched.isOff : true;
                        const startTime = sched ? sched.startTime : '08:00';
                        const endTime = sched ? sched.endTime : '17:00';
                        return (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-6 py-4 font-medium">{day}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onUpdate(index, 'isOff', false)} className={`px-3 py-1 text-xs rounded border ${!isOff ? 'bg-green-100 text-green-800' : 'bg-white text-gray-500'}`}>Work</button>
                                        <button onClick={() => onUpdate(index, 'isOff', true)} className={`px-3 py-1 text-xs rounded border ${isOff ? 'bg-red-100 text-red-800' : 'bg-white text-gray-500'}`}>Off</button>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <input type="time" value={startTime} disabled={isOff} onChange={(e) => onUpdate(index, 'startTime', e.target.value)} className="bg-white dark:bg-gray-700 border rounded px-2 py-1 disabled:opacity-30" />
                                </td>
                                <td className="px-6 py-4">
                                    <input type="time" value={endTime} disabled={isOff} onChange={(e) => onUpdate(index, 'endTime', e.target.value)} className="bg-white dark:bg-gray-700 border rounded px-2 py-1 disabled:opacity-30" />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default ScheduleTable;
