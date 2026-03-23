
import React, { useState } from 'react';
import { FileText, Download, Star } from 'lucide-react';
import Button from 'components/ui/Button';
import type { Job, BusinessDocument, Review, StoredFile } from 'types';
import { useAppContext } from 'context/AppContext';
import { useReviewEligibility } from 'hooks/useReviewEligibility';
import ReviewModal from 'components/modals/ReviewModal';
import DocumentPreview from 'components/ui/DocumentPreview';

interface ServiceHistorySectionProps {
    jobs: Job[];
    onViewReport: (job: Job) => void;
    customerId: string | null;
    organizationId: string | null;
    organizationName: string | null;
    customerName: string | null;
}

const ServiceHistorySection: React.FC<ServiceHistorySectionProps> = ({ jobs, onViewReport, customerId, organizationId, organizationName, customerName }) => {
    const { state, dispatch } = useAppContext();
    const { documents } = state;
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [viewingPastDocument, setViewingPastDocument] = useState<{ title: string; htmlContent?: string; dataUrl?: string } | null>(null);
    const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

    const { eligibility } = useReviewEligibility(customerId, organizationId);
    const { loading, canReview, hasReviewed } = eligibility;

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

    const handleReviewSubmitted = (newReview: Review) => {
        dispatch({ type: 'ADD_REVIEW', payload: newReview });
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
        <section>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                    <FileText className="text-blue-600" size={20} /> Service History
                </h3>
                {!loading && canReview && (
                    <Button onClick={() => setIsReviewModalOpen(true)} variant="outline" size="sm" className="flex items-center gap-1">
                        <Star size={14} className="text-amber-400" />
                        Leave a Review
                    </Button>
                )}
                {!loading && hasReviewed && (
                    <p className="text-sm text-slate-500 font-medium">Thanks for your feedback!</p>
                )}
            </div>
            <div className="space-y-3">
                {jobs.map(job => {
                    const jobDocs = getJobDocuments(job.id);
                    const jobFiles = (job.files || []).filter(f => !f.metadata?.isActionRequired || f.metadata?.status !== 'Pending Signature');
                    const otherFiles = jobFiles.filter(f => !f.fileType?.startsWith('image/') && !f.dataUrl?.startsWith('data:image/'));

                    return (
                        <div key={job.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <p className="font-black text-slate-900 dark:text-white text-lg">{job.tasks.join(', ')}</p>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(job.appointmentTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <Button onClick={() => onViewReport(job)} variant="secondary" className="px-5 py-2 text-xs font-black uppercase rounded-xl">View Report</Button>
                            </div>

                            {/* Photo Gallery */}
                            {(() => {
                                const photoFiles = jobFiles.filter(f => (f.fileType && f.fileType.startsWith('image/')) || f.dataUrl?.startsWith('data:image/'));
                                if (photoFiles.length === 0) return null;

                                return (
                                    <div className="mb-4">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Job Photos</h4>
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                            {photoFiles.map((photo) => (
                                                <div 
                                                    key={photo.id} 
                                                    onClick={() => setViewingPhoto(photo.dataUrl || (photo as any).url)}
                                                    className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all shadow-sm"
                                                >
                                                    <img 
                                                        src={photo.dataUrl || (photo as any).url} 
                                                        alt="Job" 
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error';
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                {otherFiles.map((file) => (
                                    <button 
                                        type="button"
                                        onClick={() => handleViewDocument(file.fileName || file.metadata?.label || 'Document', file.dataUrl || (file as any).url)}
                                        key={file.id} 
                                        className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2 hover:bg-primary-50 hover:text-primary-600 transition-all border border-transparent hover:border-primary-100 cursor-pointer"
                                    >
                                        <FileText size={12} />
                                        {file.fileName || file.metadata?.label || 'Document'}
                                    </button>
                                ))}
                                {jobDocs.map((doc, index) => (
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
                        </div>
                    )
                })}
                {jobs.length === 0 && <p className="text-slate-400 text-sm italic py-4">No completed jobs yet.</p>}
            </div>

            <ReviewModal 
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                organizationId={organizationId}
                organizationName={organizationName}
                customerId={customerId}
                customerName={customerName}
                onReviewSubmitted={handleReviewSubmitted}
            />

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

            {viewingPhoto && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setViewingPhoto(null)}
                >
                    <div className="relative max-w-full max-h-full">
                        <img 
                            src={viewingPhoto} 
                            alt="Full Preview" 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />
                        <button 
                            onClick={() => setViewingPhoto(null)}
                            className="absolute -top-4 -right-4 bg-white text-black p-2 rounded-full shadow-lg font-black hover:bg-slate-200 transition-colors"
                        >
                            X
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ServiceHistorySection;
