import showToast from "lib/toast";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Button from 'components/ui/Button';
import { db } from 'lib/firebase';
import type { Bid } from 'types';
import { PlusCircle, Shield } from 'lucide-react';

import BidList from './bids/components/BidList';
import NewBidModal from './bids/components/NewBidModal';
import BidWorkspace from './bids/components/BidWorkspace';
import { globalConfirm } from "lib/globalConfirm";

const BidOptimizationTool: React.FC = () => {
    const { state } = useAppContext();
    const { currentOrganization: org, isDemoMode } = state;
    const [bids, setBids] = useState<Bid[]>([]);
    const [viewBid, setViewBid] = useState<Bid | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const noticeId = searchParams.get('noticeId');
    const [initialBidTitle, setInitialBidTitle] = useState('');

    useEffect(() => {
        if (noticeId) {
            setIsCreateModalOpen(true);
            const titleParam = searchParams.get('title');
            if (titleParam) {
                setInitialBidTitle(`Federal Bid: ${titleParam}`);
            } else {
                // Fetch RFP title to pre-fill
                db.collection('rfp_notices').doc(noticeId).get().then(doc => {
                    if (doc.exists) {
                        setInitialBidTitle(`Bid for: ${doc.data()?.title}`);
                    }
                });
            }
        }
    }, [noticeId]);

    useEffect(() => {
        if (isDemoMode) {
            setBids(state.bids || []);
            return;
        }
        if (!org) return;
        const unsub = db.collection('bids').where('organizationId', '==', org.id).onSnapshot(snap => {
            const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Bid));
            list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setBids(list);
        });
        return () => unsub();
    }, [org, isDemoMode, state.bids]);

    const handleStartNewBid = async (title: string, linkedNoticeId?: string) => {
        if (!org) return;
        setIsProcessing(true);
        
        let initialRequirements: string[] = [];
        let initialFiles: any[] = [];
        let fetchedTitle = title;
        
        // If there is a noticeId, check if it's a SAM.gov notice (32 char hex)
        if (linkedNoticeId && linkedNoticeId.length === 32) {
            try {
                const functions = getFunctions();
                const fetchContracts = httpsCallable(functions, 'fetchFederalContracts');
                const result = await fetchContracts({ noticeId: linkedNoticeId }) as any;
                
                if (result.data?.success && result.data.opportunities?.length > 0) {
                    const opp = result.data.opportunities[0];
                    fetchedTitle = `Federal Bid: ${opp.title}`;
                    
                    let summaryText = `SAM.gov Opportunity Details:\n`;
                    if (opp.solicitationNumber) summaryText += `Solicitation Number: ${opp.solicitationNumber}\n`;
                    if (opp.fullParentPathName || opp.agency) summaryText += `Agency: ${opp.fullParentPathName || opp.agency}\n`;
                    if (opp.type) summaryText += `Notice Type: ${opp.type}\n`;
                    if (opp.setAside) summaryText += `Set Aside: ${opp.setAside}\n`;
                    if (opp.naicsCode) summaryText += `NAICS Code: ${opp.naicsCode}\n`;
                    if (opp.classificationCode) summaryText += `Classification Code: ${opp.classificationCode}\n`;
                    if (opp.responseDeadLine) summaryText += `Response Deadline: ${opp.responseDeadLine}\n`;
                    
                    summaryText += `\nOpportunity Description:\n${opp.description || 'No description provided.'}`;
                    
                    let extractedEmail = '';
                    if (opp.pointOfContact && opp.pointOfContact.length > 0) {
                        summaryText += `\n\nPoint of Contact:\n`;
                        opp.pointOfContact.forEach((poc: any) => {
                            if (poc.fullName) summaryText += `Name: ${poc.fullName}\n`;
                            if (poc.email) {
                                summaryText += `Email: ${poc.email}\n`;
                                if (!extractedEmail) extractedEmail = poc.email;
                            }
                            if (poc.phone) summaryText += `Phone: ${poc.phone}\n\n`;
                        });
                    }
                    
                    initialRequirements.push(summaryText);

                    if (opp.resourceLinks && Array.isArray(opp.resourceLinks)) {
                        initialFiles = opp.resourceLinks.map((link: string, idx: number) => {
                            const urlParts = link.split('/');
                            const hash = urlParts[urlParts.length - 2] || `doc-${idx}`;
                            return {
                                id: `sam-file-${idx}`,
                                fileName: `SAM_Attachment_${hash.substring(0, 6)}`,
                                dataUrl: link,
                                fileType: 'application/octet-stream',
                                uploadedBy: 'sam.gov'
                            };
                        });
                    }
                    
                    const bidId = `bid-${Date.now()}`;
                    const newBid: Bid = { 
                        id: bidId, 
                        organizationId: org.id, 
                        title: fetchedTitle, 
                        solicitationNumber: opp.solicitationNumber || '',
                        agency: opp.fullParentPathName || opp.agency || '',
                        dueDate: opp.responseDeadLine ? opp.responseDeadLine.split('T')[0] : '',
                        status: 'Draft', 
                        requirements: initialRequirements, 
                        files: initialFiles, 
                        createdAt: new Date().toISOString(), 
                        lineItems: [], 
                        generatedDocs: [], 
                        questions: [],
                        paymentStatus: 'Pending',
                        submissionEmail: extractedEmail || '',
                        ...(linkedNoticeId ? { noticeId: linkedNoticeId } : {})
                    };
                    
                    await db.collection('bids').doc(bidId).set(newBid);
                    setIsCreateModalOpen(false);
                    setViewBid(newBid);
                    setIsProcessing(false);
                    if (noticeId) {
                        searchParams.delete('noticeId');
                        setSearchParams(searchParams);
                    }
                    return; // Exit early since we created it
                }
            } catch (err) {
                console.error("Error fetching SAM notice details:", err);
            }
        }

        const bidId = `bid-${Date.now()}`;
        const newBid: Bid = { 
            id: bidId, 
            organizationId: org.id, 
            title: fetchedTitle, 
            status: 'Draft', 
            requirements: initialRequirements, 
            files: initialFiles, 
            createdAt: new Date().toISOString(), 
            lineItems: [], 
            generatedDocs: [], 
            questions: [],
            paymentStatus: 'Pending',
            ...(linkedNoticeId ? { noticeId: linkedNoticeId } : {})
        };
        await db.collection('bids').doc(bidId).set(newBid);
        setIsCreateModalOpen(false);
        setViewBid(newBid);
        setIsProcessing(false);
        if (noticeId) {
            searchParams.delete('noticeId');
            setSearchParams(searchParams);
        }
    };

    const updateBid = async (updates: Partial<Bid>) => {
        if (!viewBid) return;
        const updatedBid = { ...viewBid, ...updates };
        await db.collection('bids').doc(viewBid.id).update(updates);
        // Ensure the state update is a full bid object
        setViewBid(prev => prev ? { ...prev, ...updates } : null);
    };

    const deleteBid = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (await globalConfirm("Are you sure you want to delete this bid?")) {
            try {
                await db.collection('bids').doc(id).delete();
            } catch (error) {
                console.error("Error deleting bid:", error);
                showToast.warn("Failed to delete bid. Please check permissions or try again.");
            }
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex justify-end items-center">
                {!viewBid && <Button onClick={() => setIsCreateModalOpen(true)} className="shadow-lg"><PlusCircle size={18}/> New Bid</Button>}
            </header>

            {/* If there's no bid selected, show the list */}
            {!viewBid ? (
                <BidList 
                    bids={bids} 
                    onSelect={setViewBid} 
                    onDelete={deleteBid} 
                    onNew={() => setIsCreateModalOpen(true)} 
                />
            ) : (
                // If a bid IS selected, ensure it's not null before rendering the workspace
                viewBid && <BidWorkspace 
                    bid={viewBid} 
                    onClose={() => setViewBid(null)} 
                    onUpdate={updateBid}
                />
            )}
            
            <NewBidModal 
                isOpen={isCreateModalOpen} 
                onClose={() => {
                    setIsCreateModalOpen(false);
                    if (noticeId) {
                        searchParams.delete('noticeId');
                        setSearchParams(searchParams);
                    }
                }} 
                onSubmit={handleStartNewBid} 
                isProcessing={isProcessing}
                initialTitle={initialBidTitle}
                noticeId={noticeId || undefined}
            />
        </div>
    );
};

export default BidOptimizationTool;
