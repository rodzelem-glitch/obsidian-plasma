import showToast from "lib/toast";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
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
            // Fetch RFP title to pre-fill
            db.collection('rfp_notices').doc(noticeId).get().then(doc => {
                if (doc.exists) {
                    setInitialBidTitle(`Bid for: ${doc.data()?.title}`);
                }
            });
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
        const bidId = `bid-${Date.now()}`;
        const newBid: Bid = { 
            id: bidId, 
            organizationId: org.id, 
            title: title, 
            status: 'Draft', 
            requirements: [], 
            files: [], 
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
