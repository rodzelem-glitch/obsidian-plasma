
import React from 'react';
import Table from 'components/ui/Table';
import { ShiftLog } from 'types';
import { MapPin } from 'lucide-react';

interface TimesheetTableProps {
    logs: ShiftLog[];
    handleApprove: (log: ShiftLog) => void;
    handleEditClick: (log: ShiftLog) => void;
    handleDeleteClick: (log: ShiftLog) => void;
}

const TimesheetTable: React.FC<TimesheetTableProps> = ({ logs, handleApprove, handleEditClick, handleDeleteClick }) => {
    const calculateDuration = (start: string, end?: string | null) => {
        if (!end) return 'Active';
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${m}m`;
    };

    return (
        <Table headers={['Date', 'Start', 'End', 'Duration', 'Location', 'Status', 'Approval', 'Actions']}>
            {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 text-sm">{new Date(log.clockIn).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm">{new Date(log.clockIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td className="px-6 py-4 text-sm">{log.clockOut ? new Date(log.clockOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                    <td className="px-6 py-4 font-medium text-sm">{calculateDuration(log.clockIn, log.clockOut)}</td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                            {log.startLocation ? (
                                <a href={`https://maps.google.com/?q=${log.startLocation.lat},${log.startLocation.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline" title="View Clock-In Location">
                                    <MapPin size={12}/> In
                                </a>
                            ) : <span className="text-xs text-gray-400">No GPS</span>}
                            {log.endLocation && (
                                <a href={`https://maps.google.com/?q=${log.endLocation.lat},${log.endLocation.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-600 hover:underline" title="View Clock-Out Location">
                                    <MapPin size={12}/> Out
                                </a>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-xs">{log.edits?.length ? 'Edited' : 'Original'}</td>
                    <td className="px-6 py-4">
                        {log.clockOut ? <button onClick={() => !log.isApproved && handleApprove(log)} disabled={!!log.isApproved} className={`px-3 py-1 text-xs font-bold rounded ${log.isApproved ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white'}`}>{log.isApproved ? 'Approved' : 'Approve'}</button> : <span className="text-xs">Active</span>}
                    </td>
                    <td className="px-6 py-4 flex flex-col gap-2">
                        <button onClick={() => handleEditClick(log)} className="text-sm font-medium text-primary-600 hover:underline">Adjust</button>
                        <button onClick={() => handleDeleteClick(log)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                    </td>
                </tr>
            ))}
        </Table>
    );
};

export default TimesheetTable;
