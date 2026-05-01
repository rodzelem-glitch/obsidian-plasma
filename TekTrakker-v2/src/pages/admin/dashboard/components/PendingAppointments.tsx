import React, { useState } from 'react';
import type { Appointment } from '../../../../types/types';
import { Check, X, Calendar, User, Clock, Hash, MapPin, Phone, Mail, FileText } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Modal from '../../../../components/ui/Modal';

const PendingAppointments: React.FC<{ appointments: Appointment[], onAccept: (appt: Appointment) => void, onDelete: (id: string) => void }> = ({ appointments, onAccept, onDelete }) => {
    const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

    if (appointments.length === 0) return null;

    return (
        <>
            <Card className="p-4 sm:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Pending Appointments</h3>
                <div className="space-y-4">
                    {appointments.map(appt => (
                        <div 
                            key={appt.id} 
                            onClick={() => setSelectedAppt(appt)}
                            className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border border-gray-200 dark:border-gray-600 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all group"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs w-full">
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <User size={14} className="text-gray-400 group-hover:text-indigo-400 transition-colors" />
                                    <span className="font-bold">{appt.customerName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 truncate">
                                    <Hash size={14} className="text-gray-400 group-hover:text-indigo-400 transition-colors" />
                                    <span className="truncate">{appt.tasks.join(', ')}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <Calendar size={14} className="text-gray-400 group-hover:text-indigo-400 transition-colors" />
                                    <span>{new Date(appt.appointmentTime).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <Clock size={14} className="text-gray-400 group-hover:text-indigo-400 transition-colors" />
                                    <span>{new Date(appt.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                            <div className="flex-shrink-0 flex gap-2 mt-2 sm:mt-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
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

            <Modal isOpen={!!selectedAppt} onClose={() => setSelectedAppt(null)} title="Appointment Request Details" size="md">
                {selectedAppt && (
                    <div className="space-y-6">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                                <User size={18} className="text-indigo-500" />
                                <span className="font-bold text-lg">{selectedAppt.customerName}</span>
                            </div>
                            {selectedAppt.customerPhone && (
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-sm">
                                    <Phone size={18} className="text-gray-400" />
                                    <span>{selectedAppt.customerPhone}</span>
                                </div>
                            )}
                            {selectedAppt.customerEmail && (
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-sm">
                                    <Mail size={18} className="text-gray-400" />
                                    <span>{selectedAppt.customerEmail}</span>
                                </div>
                            )}
                            {selectedAppt.address && (
                                <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300 text-sm">
                                    <MapPin size={18} className="text-gray-400 mt-0.5 shrink-0" />
                                    <span>{typeof selectedAppt.address === 'string' ? selectedAppt.address : (selectedAppt.address as any).street}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-sm mt-2 font-semibold">
                                <Calendar size={18} className="text-indigo-500" />
                                <span>{new Date(selectedAppt.appointmentTime).toLocaleDateString()} at {new Date(selectedAppt.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4 rounded-xl">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Hash size={16} className="text-indigo-500" /> Requested Services
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {selectedAppt.tasks.map(t => (
                                    <span key={t} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm px-3 py-1 rounded-full text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {selectedAppt.specialInstructions && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 p-4 rounded-xl">
                                <h4 className="font-bold text-sm text-yellow-800 dark:text-yellow-500 mb-2 flex items-center gap-2">
                                    <FileText size={16} /> Customer Notes
                                </h4>
                                <p className="text-sm text-yellow-700 dark:text-yellow-400 leading-relaxed whitespace-pre-wrap">
                                    {selectedAppt.specialInstructions}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-6">
                            <button 
                                onClick={() => { onDelete(selectedAppt.id); setSelectedAppt(null); }} 
                                className="px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 font-bold rounded-xl transition-all"
                            >
                                Decline
                            </button>
                            <button 
                                onClick={() => { onAccept(selectedAppt); setSelectedAppt(null); }} 
                                className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                            >
                                Accept & Create Job
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default PendingAppointments;
