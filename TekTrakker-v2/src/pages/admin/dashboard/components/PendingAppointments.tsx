import React, { useState } from 'react';
import type { Appointment } from '../../../../types/types';
import { Check, X, Calendar, User, Clock, Hash, MapPin, Phone, Mail, FileText, Download } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Modal from '../../../../components/ui/Modal';

// Robust helper to parse and format appointmentTime strings from both ISO formats and custom Widget formats (e.g. "YYYY-MM-DD Window")
const formatApptTime = (timeStr: string) => {
    if (!timeStr) return { date: 'TBD', time: 'TBD', dateShort: 'TBD' };
    
    if (timeStr.toUpperCase() === 'TBD') {
        return { date: 'TBD', time: 'TBD', dateShort: 'TBD' };
    }

    const parts = timeStr.trim().split(/\s+/);
    if (parts.length >= 2) {
        const datePart = parts[0];
        const timePart = parts.slice(1).join(' ');
        
        const parsedDate = new Date(datePart);
        if (!isNaN(parsedDate.getTime())) {
            const formattedDate = parsedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
            const formattedDateShort = parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return { date: formattedDate, dateShort: formattedDateShort, time: timePart };
        }
    }

    const parsedWhole = new Date(timeStr);
    if (!isNaN(parsedWhole.getTime())) {
        const formattedDate = parsedWhole.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
        const formattedDateShort = parsedWhole.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        
        const timeVal = parsedWhole.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return { date: formattedDate, dateShort: formattedDateShort, time: timeVal };
    }

    return { date: timeStr, dateShort: timeStr, time: '' };
};

const PendingAppointments: React.FC<{ appointments: Appointment[], onAccept: (appt: Appointment) => void, onDelete: (id: string) => void }> = ({ appointments, onAccept, onDelete }) => {
    const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

    if (appointments.length === 0) return null;

    return (
        <>
            <Card className="p-4 sm:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Pending Appointments</h3>
                <div className="space-y-4">
                    {appointments.map(appt => {
                        const apptTimeInfo = formatApptTime(appt.appointmentTime);
                        return (
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
                                        <span>{apptTimeInfo.dateShort}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                        <Clock size={14} className="text-gray-400 group-hover:text-indigo-400 transition-colors" />
                                        <span>{apptTimeInfo.time}</span>
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
                        );
                    })}
                </div>
            </Card>

            <Modal isOpen={!!selectedAppt} onClose={() => setSelectedAppt(null)} title="Appointment Request Details" size="md">
                {selectedAppt && (() => {
                    const appt = selectedAppt as any;
                    const apptTimeInfo = formatApptTime(appt.appointmentTime);
                    return (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                                    <User size={18} className="text-indigo-500" />
                                    <span className="font-bold text-lg">{appt.customerName}</span>
                                </div>
                                {appt.customerPhone && (
                                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-sm">
                                        <Phone size={18} className="text-gray-400" />
                                        <span>{appt.customerPhone}</span>
                                    </div>
                                )}
                                {appt.customerEmail && (
                                    <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-sm">
                                        <Mail size={18} className="text-gray-400" />
                                        <span>{appt.customerEmail}</span>
                                    </div>
                                )}
                                {appt.address && (
                                    <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300 text-sm">
                                        <MapPin size={18} className="text-gray-400 mt-0.5 shrink-0" />
                                        <span>{typeof appt.address === 'string' ? appt.address : (appt.address as any).street}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300 text-sm mt-2 font-semibold">
                                    <Calendar size={18} className="text-indigo-500" />
                                    <span>{apptTimeInfo.date} at {apptTimeInfo.time}</span>
                                </div>
                            </div>

                            {/* Detailed Custom Forms section based on Customer Type */}
                            {(appt.customerType || appt.systemBrand || appt.systemAge || appt.photoUrl || appt.taxExemptUrl) && (
                                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4 rounded-xl space-y-4">
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                                        <FileText size={16} className="text-indigo-500" /> Booking Details
                                    </h4>
                                    
                                    {appt.customerType && (
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Customer Type</span>
                                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{appt.customerType}</span>
                                        </div>
                                    )}

                                    {/* Homeowner details */}
                                    {appt.customerType === 'Homeowner' && (appt.isOwner || appt.ownerName) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                                            {appt.isOwner && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Is Property Owner?</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.isOwner}</span>
                                                </div>
                                            )}
                                            {appt.isOwner === 'No' && (
                                                <>
                                                    {appt.ownerName && (
                                                        <div>
                                                            <span className="text-gray-400 font-semibold block">Landlord/Owner Name</span>
                                                            <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.ownerName}</span>
                                                        </div>
                                                    )}
                                                    {appt.ownerPhone && (
                                                        <div>
                                                            <span className="text-gray-400 font-semibold block">Landlord/Owner Phone</span>
                                                            <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.ownerPhone}</span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Tenant details */}
                                    {appt.customerType === 'Renter / Tenant' && (appt.landlordName || appt.landlordPhone) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                                            {appt.landlordName && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Landlord Name</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.landlordName}</span>
                                                </div>
                                            )}
                                            {appt.landlordPhone && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Landlord Phone</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.landlordPhone}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Business details */}
                                    {appt.customerType === 'Business / Commercial' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                                            {appt.businessName && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Business Name</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.businessName}</span>
                                                </div>
                                            )}
                                            {appt.storeLocation && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Store / Location #</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.storeLocation}</span>
                                                </div>
                                            )}
                                            {appt.onSiteContactName && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">On-Site Contact Name</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.onSiteContactName}</span>
                                                </div>
                                            )}
                                            {appt.authorizedToApprove && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Authorized to Approve?</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.authorizedToApprove}</span>
                                                </div>
                                            )}
                                            {(appt.commercialBillingEmail || appt.billingEmail) && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Billing Contact Email</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.commercialBillingEmail || appt.billingEmail}</span>
                                                </div>
                                            )}
                                            {appt.poRequired && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">PO Required?</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.poRequired}</span>
                                                </div>
                                            )}
                                            {appt.approvalLimit && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Approval Limit</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.approvalLimit}</span>
                                                </div>
                                            )}
                                            {(appt.commercialTaxExempt || appt.taxExempt) && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Tax Exempt?</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.commercialTaxExempt || appt.taxExempt}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Property Manager details */}
                                    {appt.customerType === 'Property Manager' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                                            {appt.pmCompanyName && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Management Company</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.pmCompanyName}</span>
                                                </div>
                                            )}
                                            {appt.pmContactName && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">PM Contact Name</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.pmContactName}</span>
                                                </div>
                                            )}
                                            {appt.ownerApprovalRequired && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Owner Approval Required?</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.ownerApprovalRequired}</span>
                                                </div>
                                            )}
                                            {(appt.pmBillingEmail || appt.billingEmail) && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Billing / AP Email</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.pmBillingEmail || appt.billingEmail}</span>
                                                </div>
                                            )}
                                            {(appt.pmTaxExempt || appt.taxExempt) && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Tax Exempt?</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.pmTaxExempt || appt.taxExempt}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* General Contractor details */}
                                    {appt.customerType === 'General Contractor' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                                            {appt.gcCompanyName && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">GC Company Name</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.gcCompanyName}</span>
                                                </div>
                                            )}
                                            {appt.gcContactName && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Project Manager</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.gcContactName}</span>
                                                </div>
                                            )}
                                            {appt.gcJobName && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Job Name / Ref #</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.gcJobName}</span>
                                                </div>
                                            )}
                                            {(appt.gcBillingEmail || appt.billingEmail) && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Billing / AP Email</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.gcBillingEmail || appt.billingEmail}</span>
                                                </div>
                                            )}
                                            {(appt.gcPoRequired || appt.poRequired) && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">PO Required?</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.gcPoRequired || appt.poRequired}</span>
                                                </div>
                                            )}
                                            {(appt.gcTaxExempt || appt.taxExempt) && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">Tax Exempt?</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.gcTaxExempt || appt.taxExempt}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* System specs */}
                                    {(appt.systemAge || appt.systemBrand) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-200 dark:border-gray-700">
                                            {appt.systemBrand && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">System Brand</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.systemBrand}</span>
                                                </div>
                                            )}
                                            {appt.systemAge && (
                                                <div>
                                                    <span className="text-gray-400 font-semibold block">System Age</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-bold">{appt.systemAge} years</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Uploaded files */}
                                    {(appt.photoUrl || appt.taxExemptUrl) && (
                                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Attached Files</span>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {appt.photoUrl && (
                                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-800 flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                            <img src={appt.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block truncate">Equipment Photo</span>
                                                            <a href={appt.photoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold">View File</a>
                                                        </div>
                                                    </div>
                                                )}
                                                {appt.taxExemptUrl && (
                                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-800 flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded bg-indigo-50 dark:bg-indigo-950/40 overflow-hidden flex-shrink-0 flex items-center justify-center text-indigo-500">
                                                            <FileText size={18} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block truncate">Tax Exemption Cert</span>
                                                            <a href={appt.taxExemptUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold">View File</a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4 rounded-xl">
                                <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <Hash size={16} className="text-indigo-500" /> Requested Services
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {appt.tasks.map((t: string) => (
                                        <span key={t} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm px-3 py-1 rounded-full text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {appt.specialInstructions && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 p-4 rounded-xl">
                                    <h4 className="font-bold text-sm text-yellow-800 dark:text-yellow-500 mb-2 flex items-center gap-2">
                                        <FileText size={16} /> Customer Notes
                                    </h4>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-400 leading-relaxed whitespace-pre-wrap">
                                        {appt.specialInstructions}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6">
                                <button 
                                    onClick={() => { onDelete(appt.id); setSelectedAppt(null); }} 
                                    className="px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 font-bold rounded-xl transition-all"
                                >
                                    Decline
                                </button>
                                <button 
                                    onClick={() => { onAccept(appt); setSelectedAppt(null); }} 
                                    className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                                >
                                    Accept & Create Job
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </>
    );
};

export default PendingAppointments;
