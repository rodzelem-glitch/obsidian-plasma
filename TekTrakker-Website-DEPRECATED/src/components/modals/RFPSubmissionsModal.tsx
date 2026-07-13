import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import type { RFPNotice } from '../../types';
import showToast from '../../lib/toast';
import { MessageCircle, CheckCircle, X } from 'lucide-react';

interface RFPSubmissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    rfp: RFPNotice | null;
}

const RFPSubmissionsModal: React.FC<RFPSubmissionsModalProps> = ({ isOpen, onClose, rfp }) => {
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isOpen || !rfp) return;
        
        setIsLoading(true);
        const unsubscribe = db.collection('rfp_notices').doc(rfp.id).collection('submissions')
            .onSnapshot(async snapshot => {
                const subs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
                
                // Fetch org details for each submission
                const subsWithOrgs = await Promise.all(subs.map(async sub => {
                    if (sub.organizationId) {
                        const orgDoc = await db.collection('organizations').doc(sub.organizationId).get();
                        return { ...sub, orgName: orgDoc.data()?.name || 'Unknown Organization', orgEmail: orgDoc.data()?.email };
                    }
                    return sub;
                }));
                
                setSubmissions(subsWithOrgs);
                setIsLoading(false);
            }, error => {
                console.error("Error fetching submissions:", error);
                setIsLoading(false);
            });

        return () => unsubscribe();
    }, [isOpen, rfp]);

    const handleAwardBid = async (submissionId: string, orgId: string, orgName: string) => {
        if (!rfp) return;
        try {
            // Update submission status
            await db.collection('rfp_notices').doc(rfp.id).collection('submissions').doc(submissionId).update({
                status: 'Won',
                awardedAt: new Date().toISOString()
            });

            // Update Bid status
            await db.collection('bids').doc(submissionId).update({
                status: 'Won'
            });

            // Update RFP status to Partially Awarded
            const updatedAwardedToIds = [...new Set([...(rfp.awardedToIds || []), orgId])];
            await db.collection('rfp_notices').doc(rfp.id).update({
                status: 'Partially Awarded',
                awardedToIds: updatedAwardedToIds
            });

            // Add as subcontractor implicitly
            const currentOrgId = rfp.organizationId;
            await db.collection('organizations').doc(currentOrgId).collection('subcontractors').doc(orgId).set({
                organizationId: orgId,
                name: orgName,
                status: 'Active',
                addedAt: new Date().toISOString(),
                sourceRfp: rfp.id
            }, { merge: true });

            if (rfp.projectId) {
                const projectRef = db.collection('projects').doc(rfp.projectId);
                const docSnap = await projectRef.get();
                if (docSnap.exists) {
                    const data = docSnap.data();
                    const updatedSubs = [...new Set([...(data?.assignedSubcontractorIds || []), orgId])];
                    await projectRef.update({ assignedSubcontractorIds: updatedSubs });
                }
            }

            showToast.success(`Bid awarded to ${orgName}! They have been added to your subcontractors${rfp.projectId ? ' and project' : ''}.`);
            onClose();
        } catch (err) {
            console.error(err);
            showToast.error("Failed to award bid.");
        }
    };

    const handleCloseRFP = async () => {
        if (!rfp) return;
        try {
            await db.collection('rfp_notices').doc(rfp.id).update({
                status: 'Awarded'
            });
            showToast.success("RFP has been successfully closed and finalized.");
            onClose();
        } catch (err) {
            console.error(err);
            showToast.error("Failed to close RFP.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm sm:p-6">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Submissions for: {rfp?.title}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review incoming bids and award the contract.</p>
                    </div>
                    <button
                        onClick={onClose}
                        title="Close"
                        aria-label="Close"
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-8 text-slate-500">Loading submissions...</div>
                        ) : submissions.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                                No submissions yet for this RFP.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {submissions.map(sub => (
                                    <div key={sub.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{sub.orgName}</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Bid ID: {sub.bidId}</p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                                                sub.status === 'Won' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            }`}>
                                                {sub.status || 'Submitted'}
                                            </span>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button 
                                                onClick={() => {
                                                    navigate(`/admin/messages?partner=${sub.organizationId}`);
                                                    onClose();
                                                }}
                                                className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700"
                                                title="Message Contractor"
                                            >
                                                <MessageCircle size={18} />
                                            </button>
                                            {sub.status !== 'Won' && (rfp?.status === 'Open' || rfp?.status === 'Partially Awarded') && (
                                                <button 
                                                    onClick={() => handleAwardBid(sub.id, sub.organizationId, sub.orgName)}
                                                    className="px-3 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors rounded-md shadow-sm flex items-center gap-1 text-sm font-medium"
                                                >
                                                    <CheckCircle size={16} />
                                                    Award
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {rfp?.status === 'Awarded' ? 'This RFP has been finalized.' : 'You can award multiple bids for different components of this RFP.'}
                    </p>
                    {rfp?.status !== 'Awarded' && (
                        <button
                            onClick={handleCloseRFP}
                            className="px-4 py-2 bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 hover:bg-slate-800 transition-colors rounded-lg text-sm font-medium shadow-sm"
                        >
                            Finalize & Close RFP
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RFPSubmissionsModal;
