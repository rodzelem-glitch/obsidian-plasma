
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
        <>
            {/* Mobile Cards View (App / Mobile View Only) */}
            <div className="md:hidden space-y-3 p-1">
                {logs.map(log => {
                    const duration = calculateDuration(log.clockIn, log.clockOut);
                    const isActive = !log.clockOut;

                    return (
                        <div key={`ts-card-${log.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3">
                            {/* Card Header: Date & Duration / Status */}
                            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                                <div>
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                                        {new Date(log.clockIn).toLocaleDateString()}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                        <span>{new Date(log.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span>→</span>
                                        <span>{log.clockOut ? new Date(log.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${isActive ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'}`}>
                                        {duration}
                                    </span>
                                    {log.edits?.length ? (
                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
                                            Edited ({log.edits.length})
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-slate-400 mt-1">Original</span>
                                    )}
                                </div>
                            </div>

                            {/* GPS Locations */}
                            <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                {log.startLocation ? (
                                    <a 
                                        href={`https://maps.google.com/?q=${log.startLocation.lat},${log.startLocation.lng}`} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        <MapPin size={13} /> Clock-In GPS
                                    </a>
                                ) : (
                                    <span className="text-xs text-slate-400">No Start GPS</span>
                                )}

                                {log.endLocation ? (
                                    <a 
                                        href={`https://maps.google.com/?q=${log.endLocation.lat},${log.endLocation.lng}`} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium ml-auto"
                                    >
                                        <MapPin size={13} /> Clock-Out GPS
                                    </a>
                                ) : (
                                    log.clockOut && <span className="text-xs text-slate-400 ml-auto">No End GPS</span>
                                )}
                            </div>

                            {/* Approval & Action Bar */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                                <div>
                                    {log.clockOut ? (
                                        <button 
                                            onClick={() => !log.isApproved && handleApprove(log)} 
                                            disabled={!!log.isApproved} 
                                            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${log.isApproved ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'}`}
                                        >
                                            {log.isApproved ? '✓ Approved' : 'Approve Shift'}
                                        </button>
                                    ) : (
                                        <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                            Active Shift
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleEditClick(log)} 
                                        className="px-2.5 py-1 text-xs font-bold text-primary-600 hover:underline bg-slate-100 dark:bg-slate-800 rounded-lg"
                                    >
                                        Adjust
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteClick(log)} 
                                        className="px-2.5 py-1 text-xs font-bold text-red-600 hover:underline bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {logs.length === 0 && (
                    <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                        No shift logs found.
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
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
            </div>
        </>
    );
};

export default TimesheetTable;
