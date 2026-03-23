
import React from 'react';
import type { Appointment } from '../../../../types/types';
import { Check, X, Calendar, User, Clock, Hash } from 'lucide-react';
import Card from '../../../../components/ui/Card';

const PendingAppointments: React.FC<{ appointments: Appointment[], onAccept: (appt: Appointment) => void, onDelete: (id: string) => void }> = ({ appointments, onAccept, onDelete }) => {
    if (appointments.length === 0) return null;

    return (
        <Card className="p-4 sm:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Pending Appointments</h3>
            <div className="space-y-4">
                {appointments.map(appt => (
                    <div key={appt.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs w-full">
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <User size={14} className="text-gray-400" />
                                <span className="font-bold">{appt.customerName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <Hash size={14} className="text-gray-400" />
                                <span>{appt.tasks.join(', ')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <Calendar size={14} className="text-gray-400" />
                                <span>{new Date(appt.appointmentTime).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <Clock size={14} className="text-gray-400" />
                                <span>{new Date(appt.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex gap-2 mt-2 sm:mt-0 self-end sm:self-center">
                            <button 
                                onClick={() => onAccept(appt)}
                                className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-sm"
                                aria-label="Accept"
                            >
                                <Check size={16} />
                            </button>
                            <button 
                                onClick={() => onDelete(appt.id)}
                                className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                                aria-label="Delete"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export default PendingAppointments;
