
import React, { useMemo, useState } from 'react';
import Card from 'components/ui/Card';
import { CalendarIcon, Clock, FileText, ShieldCheck, Star, Award, User } from 'lucide-react';
import type { Job, BusinessDocument, User as AppUser } from 'types';
import DocumentPreview from 'components/ui/DocumentPreview';

interface AppointmentsSectionProps {
    jobs: Job[];
    documents: BusinessDocument[];
    users?: AppUser[]; // All org users to look up technicians
}

const CertBadge: React.FC<{ label: string; icon: React.ReactNode }> = ({ label, icon }) => (
    <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-black border border-emerald-200 dark:border-emerald-800">
        {icon} {label}
    </div>
);

const AppointmentsSection: React.FC<AppointmentsSectionProps> = ({ jobs, documents, users = [] }) => {
    const [viewingPastDocument, setViewingPastDocument] = useState<{ title: string; htmlContent?: string; dataUrl?: string } | null>(null);

    const getJobDocuments = (jobId: string): BusinessDocument[] => {
        const seen = new Set();
        return documents.filter(doc => {
            if (doc.jobId === jobId && !seen.has(doc.id)) {
                seen.add(doc.id);
                return true;
            }
            return false;
        });
    };

    const getTech = (job: Job): AppUser | undefined => {
        if (!job.assignedTechnicianId) return undefined;
        return users.find(u => u.id === job.assignedTechnicianId);
    };

    const handleViewDocument = (title: string, dataUrl?: string, content?: string) => {
        try {
            if (dataUrl && dataUrl.startsWith('data:text/html;base64,')) {
                const base64 = dataUrl.split(',')[1];
                const decodedHtml = decodeURIComponent(escape(atob(base64)));
                setViewingPastDocument({ title, htmlContent: decodedHtml });
            } else if (content) {
                setViewingPastDocument({ title, htmlContent: content });
            } else if (dataUrl) {
                window.open(dataUrl, '_blank');
            }
        } catch (e) {
            console.error("Failed to parse document:", e);
            if (dataUrl) window.open(dataUrl, '_blank');
        }
    };

    return (
        <>
        <section>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                <CalendarIcon className="text-primary-600" size={20} /> Upcoming Appointments
            </h3>
            <div className="space-y-4">
                {jobs.length > 0 ? jobs.map(job => {
                    const tech = getTech(job);
                    const certs = tech?.certifications || [];
                    const hasEPA = certs.some((c: any) => c.name?.toLowerCase().includes('epa'));
                    const hasDriversLicense = certs.some((c: any) => c.name?.toLowerCase().includes('driver') || c.name?.toLowerCase().includes('license'));
                    const isInProgress = job.jobStatus === 'In Progress';

                    return (
                        <Card key={job.id} className={`border-2 transition-colors ${isInProgress ? 'border-primary-400 dark:border-primary-600 shadow-lg shadow-primary-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-primary-300'}`}>
                            {/* Status Banner */}
                            {isInProgress && (
                                <div className="bg-primary-600 text-white text-center py-1.5 text-[10px] font-black uppercase tracking-widest -mt-6 -mx-6 mb-4 rounded-t-2xl flex items-center justify-center gap-2">
                                    <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                    Technician En Route / On Site
                                </div>
                            )}

                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Date Block */}
                                <div className="flex gap-4 items-start flex-1">
                                    <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex flex-col items-center justify-center font-black shrink-0">
                                        <span className="text-[10px] uppercase tracking-tighter">{new Date(job.appointmentTime).toLocaleString(undefined, { month: 'short' })}</span>
                                        <span className="text-xl leading-none">{new Date(job.appointmentTime).getDate()}</span>
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 dark:text-white text-lg">{job.tasks.join(', ')}</p>
                                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                            <Clock size={14} /> {new Date(job.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1 capitalize">{job.jobStatus}</p>
                                    </div>
                                </div>

                                {/* Technician Card */}
                                {tech ? (
                                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 min-w-[220px]">
                                        <div className="relative shrink-0">
                                            {tech.profilePicUrl ? (
                                                <img src={tech.profilePicUrl} className="w-14 h-14 rounded-full object-cover border-2 border-emerald-400" alt={`${tech.firstName} ${tech.lastName}`} />
                                            ) : (
                                                <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-2 border-emerald-400">
                                                    <User size={24} className="text-slate-400" />
                                                </div>
                                            )}
                                            {/* Verified Badge Overlay */}
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900" title="Verified Technician">
                                                <ShieldCheck size={10} className="text-white" />
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-black text-slate-900 dark:text-white text-sm truncate">{tech.firstName} {tech.lastName}</p>
                                            <p className="text-[10px] font-bold uppercase text-slate-400 capitalize">{tech.role?.replace('_', ' ')}</p>
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                <CertBadge label="Verified" icon={<ShieldCheck size={9} />} />
                                                {hasEPA && <CertBadge label="EPA Cert" icon={<Award size={9} />} />}
                                                {hasDriversLicense && <CertBadge label="Licensed" icon={<Star size={9} />} />}
                                                {certs.length > 0 && !hasEPA && <CertBadge label="Certified" icon={<Award size={9} />} />}
                                            </div>
                                        </div>
                                    </div>
                                ) : job.assignedTechnicianName ? (
                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
                                        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                            <User size={20} className="text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-slate-900 dark:text-white">{job.assignedTechnicianName}</p>
                                            <div className="flex gap-1 mt-1">
                                                <CertBadge label="Verified" icon={<ShieldCheck size={9} />} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-slate-400 text-xs italic px-4">
                                        Technician assignment pending
                                    </div>
                                )}
                            </div>

                            {/* Files and Documents Section */}
                            {((job.files || []).filter(f => !(f as any).fileType?.startsWith('image/')).length > 0 || getJobDocuments(job.id).length > 0) && (
                                <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                                    {(job.files || []).filter(f => !((f as any).fileType?.startsWith('image/'))).map((file) => (
                                        <button
                                            type="button"
                                            onClick={() => handleViewDocument(file.fileName || (file as any).metadata?.label || 'Document', file.dataUrl || (file as any).url)}
                                            key={file.id}
                                            className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-600 transition-all border border-transparent hover:border-primary-100 cursor-pointer"
                                        >
                                            <FileText size={12} />
                                            {file.fileName || (file as any).metadata?.label || 'Document'}
                                        </button>
                                    ))}
                                    {getJobDocuments(job.id).map((doc, index) => (
                                        <button
                                            type="button"
                                            onClick={() => handleViewDocument(doc.title, doc.url, doc.content)}
                                            key={`${doc.id}-${index}`}
                                            className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-600 transition-all border border-transparent hover:border-primary-100 cursor-pointer"
                                        >
                                            <FileText size={12} />
                                            {doc.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Card>
                    );
                }) : (
                    <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-10 text-center text-slate-400 font-bold italic">
                        No upcoming appointments scheduled.
                    </div>
                )}
            </div>
        </section>

        {viewingPastDocument && (
            <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-900 flex flex-col">
                <DocumentPreview
                    type="Other"
                    data={{
                        title: viewingPastDocument.title,
                        htmlContent: viewingPastDocument.htmlContent,
                    }}
                    onClose={() => setViewingPastDocument(null)}
                    isInternal={false}
                />
            </div>
        )}
        </>
    );
};

export default AppointmentsSection;
