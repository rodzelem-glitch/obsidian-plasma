import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsersIcon, FileText, Search, PlusCircle, CheckCircle2, MapPin, DollarSign, Briefcase } from 'lucide-react';
import CreateRFPModal from '../../components/modals/CreateRFPModal';
import RFPSubmissionsModal from '../../components/modals/RFPSubmissionsModal';
import { useAppContext } from '../../context/AppContext';
import { db } from '../../lib/firebase';
import type { RFPNotice, Bid } from '../../types';
import showToast from '../../lib/toast';

const ContractorNetwork: React.FC = () => {
    const { state } = useAppContext();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'board' | 'my-rfps' | 'my-submissions'>('board');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedRFP, setSelectedRFP] = useState<RFPNotice | null>(null);
    const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
    const [myRFPs, setMyRFPs] = useState<RFPNotice[]>([]);
    const [publicRFPs, setPublicRFPs] = useState<RFPNotice[]>([]);
    const [mySubmissions, setMySubmissions] = useState<any[]>([]); // Using any for Bid type to avoid adding another import if we don't have it, actually let's import Bid from types.
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPublic, setIsLoadingPublic] = useState(true);

    useEffect(() => {
        if (!state.currentOrganization) return;
        
        // Fetch My RFPs
        const unsubscribeMy = db.collection('rfp_notices')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snapshot => {
                const notices = snapshot.docs.map(doc => doc.data() as RFPNotice);
                setMyRFPs(notices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                setIsLoading(false);
            }, error => {
                console.error("Error fetching my RFPs:", error);
                setIsLoading(false);
            });

        // Fetch Public RFPs
        const unsubscribePublic = db.collection('rfp_notices')
            .where('visibility', '==', 'Public')
            .where('status', '==', 'Open')
            .onSnapshot(snapshot => {
                const notices = snapshot.docs.map(doc => doc.data() as RFPNotice);
                // Filter out the current organization's own RFPs from the public feed
                const filtered = notices.filter(n => n.organizationId !== state.currentOrganization?.id);
                setPublicRFPs(filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                setIsLoadingPublic(false);
            }, error => {
                console.error("Error fetching public RFPs:", error);
                setIsLoadingPublic(false);
            });

        // Fetch My Submissions (Bids linked to an RFP)
        const unsubscribeSubmissions = db.collection('bids')
            .where('organizationId', '==', state.currentOrganization.id)
            .onSnapshot(snapshot => {
                const bids = snapshot.docs.map(doc => doc.data() as Bid).filter(b => !!b.noticeId);
                setMySubmissions(bids.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            }, error => {
                console.error("Error fetching submissions:", error);
            });

        return () => {
            unsubscribeMy();
            unsubscribePublic();
            unsubscribeSubmissions();
        };
    }, [state.currentOrganization]);

    const handleSaveRFP = async (form: Partial<RFPNotice>) => {
        if (!state.currentOrganization) {
            showToast.error('No organization selected.');
            return;
        }

        try {
            const rfpId = `rfp-${Date.now()}`;
            const newRFP: RFPNotice = {
                ...form,
                id: rfpId,
                organizationId: state.currentOrganization.id,
                status: 'Open',
                requirements: form.requirements || [],
                files: form.files || [],
                createdAt: new Date().toISOString()
            } as RFPNotice;

            await db.collection('rfp_notices').doc(rfpId).set(newRFP);
            showToast.success('RFP posted successfully!');
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error("Error saving RFP:", error);
            showToast.error('Failed to post RFP.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/80 overflow-hidden">
                <div className="flex border-b border-slate-200 dark:border-slate-700/80 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('board')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'board' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/10' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    >
                        <Search size={18} />
                        Notice Board
                    </button>
                    <button
                        onClick={() => setActiveTab('my-rfps')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'my-rfps' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/10' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    >
                        <PlusCircle size={18} />
                        My RFPs
                    </button>
                    <button
                        onClick={() => setActiveTab('my-submissions')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'my-submissions' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/10' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    >
                        <CheckCircle2 size={18} />
                        My Submissions
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'board' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Notice Board</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Discover and bid on B2B subcontracting opportunities.</p>
                                </div>
                            </div>
                            
                            {isLoadingPublic ? (
                                <div className="text-center py-12 text-slate-500">Loading network opportunities...</div>
                            ) : publicRFPs.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                    <UsersIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No Open RFPs Available</h3>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                                        There are currently no public opportunities available from other organizations. Check back later!
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {publicRFPs.map(rfp => (
                                        <div key={rfp.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800 hover:border-primary-300 transition-colors shadow-sm flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    Open for Bids
                                                </span>
                                                <span className="text-xs text-slate-400">Due: {rfp.dueDate ? new Date(rfp.dueDate).toLocaleDateString() : 'N/A'}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">{rfp.title}</h4>
                                            {rfp.description && (
                                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">{rfp.description}</p>
                                            )}
                                            <div className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400 mb-4 flex-grow">
                                                <p className="flex items-start gap-2"><Briefcase size={14} className="mt-1 flex-shrink-0" /> 
                                                    <span className="flex flex-wrap gap-1">
                                                        {(rfp.trades && rfp.trades.length > 0) ? rfp.trades.map(t => (
                                                            <span key={t} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs">{t}</span>
                                                        )) : (
                                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs">{rfp.trade}</span>
                                                        )}
                                                    </span>
                                                </p>
                                                <p className="flex items-center gap-2"><MapPin size={14} /> {rfp.location}</p>
                                                {rfp.budgetRange && <p className="flex items-center gap-2"><DollarSign size={14} /> {rfp.budgetRange}</p>}
                                            </div>
                                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                                                <button 
                                                    onClick={() => navigate(`/admin/contracts?noticeId=${rfp.id}`)}
                                                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    View Details & Apply
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'my-rfps' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">My Posted RFPs</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage notices you've published to the network.</p>
                                </div>
                                <button 
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
                                >
                                    <PlusCircle size={16} />
                                    Post New RFP
                                </button>
                            </div>
                            
                            {isLoading ? (
                                <div className="text-center py-12 text-slate-500">Loading your RFPs...</div>
                            ) : myRFPs.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                    <FileText className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No RFPs Posted</h3>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                                        Convert any won Bid into a Project, and easily extract tasks to post as an RFP here.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {myRFPs.map(rfp => (
                                        <div key={rfp.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800 hover:border-primary-300 transition-colors">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                                    rfp.status === 'Open' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    rfp.status === 'Partially Awarded' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    rfp.status === 'Awarded' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                }`}>
                                                    {rfp.status}
                                                </span>
                                                <span className="text-xs text-slate-400">{new Date(rfp.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">{rfp.title}</h4>
                                            {rfp.awardedToIds && rfp.awardedToIds.length > 0 && (
                                                <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 text-xs font-medium border border-indigo-100 dark:border-indigo-800/50">
                                                    <CheckCircle2 size={12} />
                                                    Awarded to {rfp.awardedToIds.length} Contractor{rfp.awardedToIds.length !== 1 ? 's' : ''}
                                                </div>
                                            )}
                                            <div className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                                                <p className="flex items-start gap-2"><Briefcase size={14} className="mt-1 flex-shrink-0" /> 
                                                    <span className="flex flex-wrap gap-1">
                                                        {(rfp.trades && rfp.trades.length > 0) ? rfp.trades.map(t => (
                                                            <span key={t} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs">{t}</span>
                                                        )) : (
                                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs">{rfp.trade}</span>
                                                        )}
                                                    </span>
                                                </p>
                                                <p className="flex items-center gap-2"><MapPin size={14} /> {rfp.location}</p>
                                                {rfp.budgetRange && <p className="flex items-center gap-2"><DollarSign size={14} /> {rfp.budgetRange}</p>}
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedRFP(rfp);
                                                        setIsSubmissionsModalOpen(true);
                                                    }}
                                                    className="w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-200 dark:border-slate-600"
                                                >
                                                    Review Submissions
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'my-submissions' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">My Submissions</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Track the status of bids you have submitted to network RFPs.</p>
                                </div>
                            </div>
                            
                            {mySubmissions.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                    <CheckCircle2 className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No Submissions Yet</h3>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                        When you submit proposals to other organizations on the platform, track their status here.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {mySubmissions.map(bid => (
                                        <div key={bid.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-white dark:bg-slate-800 hover:border-primary-300 transition-colors shadow-sm flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                                    bid.status === 'Won' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    bid.status === 'Lost' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    bid.status === 'Submitted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                }`}>
                                                    {bid.status}
                                                </span>
                                                <span className="text-xs text-slate-400">{new Date(bid.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <h4 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">{bid.title}</h4>
                                            
                                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
                                                <button 
                                                    onClick={() => navigate(`/admin/contracts?noticeId=${bid.noticeId}`)} // or directly to the bid
                                                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    View Proposal in Workspace
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <CreateRFPModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleSaveRFP}
            />

            <RFPSubmissionsModal
                isOpen={isSubmissionsModalOpen}
                onClose={() => {
                    setIsSubmissionsModalOpen(false);
                    setSelectedRFP(null);
                }}
                rfp={selectedRFP}
            />
        </div>
    );
};

export default ContractorNetwork;
