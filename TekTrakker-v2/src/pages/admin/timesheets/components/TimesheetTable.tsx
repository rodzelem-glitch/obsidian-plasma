
import React from 'react';
import Table from 'components/ui/Table';
import { ShiftLog } from 'types';

interface TimesheetTableProps {
    logs: ShiftLog[];
    handleApprove: (log: ShiftLog) => void;
    handleEditClick: (log: ShiftLog) => void;
}

const TimesheetTable: React.FC<TimesheetTableProps> = ({ logs, handleApprove, handleEditClick }) => {
    const calculateDuration = (start: string, end?: string | null) => {
        if (!end) return 'Active';
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${m}m`;
    };

    return (
        <Table headers={['Date', 'Start', 'End', 'Duration', 'Status', 'Approval', 'Actions']}>
            {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 text-sm">{new Date(log.clockIn).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm">{new Date(log.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td className="px-6 py-4 text-sm">{log.clockOut ? new Date(log.clockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                    <td className="px-6 py-4 font-medium text-sm">{calculateDuration(log.clockIn, log.clockOut)}</td>
                    <td className="px-6 py-4 text-xs">{log.edits?.length ? 'Edited' : 'Original'}</td>
                    <td className="px-6 py-4">
                        {log.clockOut ? <button onClick={() => !log.isApproved && handleApprove(log)} disabled={!!log.isApproved} className={`px-3 py-1 text-xs font-bold rounded ${log.isApproved ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white'}`}>{log.isApproved ? 'Approved' : 'Approve'}</button> : <span className="text-xs">Active</span>}
                    </td>
                    <td className="px-6 py-4">
                        <button onClick={() => handleEditClick(log)} className="text-sm font-medium text-primary-600 hover:underline">Adjust</button>
                    </td>
                </tr>
            ))}
        </Table>
    );
};

export default TimesheetTable;
