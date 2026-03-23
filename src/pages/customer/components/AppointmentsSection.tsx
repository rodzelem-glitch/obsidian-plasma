
import React, { useMemo, useState } from 'react';
import Card from 'components/ui/Card';
import { CalendarIcon, Clock, FileText } from 'lucide-react';
import type { Job, BusinessDocument } from 'types';
import DocumentPreview from 'components/ui/DocumentPreview';

interface AppointmentsSectionProps {
    jobs: Job[];
    documents: BusinessDocument[];
}

const AppointmentsSection: React.FC<AppointmentsSectionProps> = ({ jobs, documents }) => {
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
                {jobs.length > 0 ? jobs.map(job => (
                    <Card key={job.id} className="p-6 border-2 border-slate-200 dark:border-slate-800 hover:border-primary-500 transition-colors">
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex flex-col items-center justify-center font-black">
                                    <span className="text-[10px] uppercase tracking-tighter">{new Date(job.appointmentTime).toLocaleString(undefined, { month: 'short' })}</span>
                                    <span className="text-xl leading-none">{new Date(job.appointmentTime).getDate()}</span>
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 dark:text-white text-lg">{job.tasks.join(', ')}</p>
                                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                        <Clock size={14} /> {new Date(job.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Files and Documents Section */}
                        <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                            {(job.files || []).filter(f => !f.metadata?.isActionRequired || f.metadata?.status !== 'Pending Signature')
                                .filter(f => !f.fileType.startsWith('image/')).map((file) => (
                                <button 
                                    type="button"
                                    onClick={() => handleViewDocument(file.fileName || file.metadata?.label || 'Document', file.dataUrl)}
                                    key={file.id} 
                                    className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-600 transition-all border border-transparent hover:border-primary-100 cursor-pointer"
                                >
                                    <FileText size={12} />
                                    {file.fileName || file.metadata?.label || 'Document'}
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
                    </Card>
                )) : (
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
                        // fallback file access handled directly in handleViewDocument
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
