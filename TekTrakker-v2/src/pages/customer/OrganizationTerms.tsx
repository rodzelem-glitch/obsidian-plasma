import { cleanUndefinedFields } from '../../lib/utils';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { Customer, Organization } from 'types';
import Button from 'components/ui/Button';
import showToast from 'lib/toast';
import { FileText, Shield, ArrowLeft, Check, Printer, Lock } from 'lucide-react';

const OrganizationTerms: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { currentUser } = state;
    const navigate = useNavigate();

    const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
    const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('portal');

    useEffect(() => {
        const loadTermsData = async () => {
            if (!currentUser) return;
            setIsLoading(true);
            try {
                // Try loading from localStorage first
                const cachedCustId = localStorage.getItem('activeCustomerRecordId');
                const cachedOrgId = localStorage.getItem('activeOrgId');

                let custId = cachedCustId;
                let orgId = cachedOrgId;

                // Fallback: query customer records linked to current user
                if (!custId || !orgId) {
                    const snap = await db.collection('customers')
                        .where('userId', '==', currentUser.uid)
                        .get();
                    if (!snap.empty) {
                        const doc = snap.docs[0];
                        custId = doc.id;
                        orgId = doc.data().organizationId;
                    }
                }

                if (custId) {
                    const custDoc = await db.collection('customers').doc(custId).get();
                    if (custDoc.exists) {
                        setActiveCustomer({ id: custDoc.id, ...custDoc.data() } as Customer);
                    }
                }

                if (orgId) {
                    const orgDoc = await db.collection('organizations').doc(orgId).get();
                    if (orgDoc.exists) {
                        setActiveOrg({ id: orgDoc.id, ...orgDoc.data() } as Organization);
                    }
                }
            } catch (err) {
                console.error("Error loading terms data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        loadTermsData();
    }, [currentUser]);

    const handleAcceptAll = async () => {
        if (!activeCustomer || !activeOrg) return;
        const now = new Date().toISOString();
        try {
            await db.collection('customers').doc(activeCustomer.id).update(cleanUndefinedFields({
                agreedToCustomerTerms: true,
                customerTermsAgreedAt: now
            }));

            dispatch({
                type: 'UPDATE_CUSTOMER',
                payload: {
                    id: activeCustomer.id,
                    agreedToCustomerTerms: true,
                    customerTermsAgreedAt: now
                }
            });

            setActiveCustomer(prev => prev ? {
                ...prev,
                agreedToCustomerTerms: true,
                customerTermsAgreedAt: now
            } : null);

            showToast.success("All terms have been successfully accepted!");
            navigate('/portal');
        } catch (e: any) {
            showToast.warn("Failed to record agreement: " + e.message);
        }
    };

    const handlePrint = (title: string, content: string) => {
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`
                <html>
                    <head>
                        <title>${title} - ${activeOrg?.name || 'Terms'}</title>
                        <style>
                            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                            h1 { border-bottom: 2px solid #eaeaea; padding-bottom: 10px; }
                            .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
                            .content { white-space: pre-wrap; font-size: 14px; }
                        </style>
                    </head>
                    <body>
                        <h1>${title}</h1>
                        <div class="meta">Organization: ${activeOrg?.name || ''}</div>
                        <div class="content">${content}</div>
                        <script>window.print();</script>
                    </body>
                </html>
            `);
            win.document.close();
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">Loading agreements...</div>
            </div>
        );
    }

    if (!activeOrg) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-6 text-center">
                <Shield size={48} className="text-slate-400 mb-4" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Organization Selected</h3>
                <p className="text-sm text-slate-500 mt-2">Could not load the terms for your active service provider.</p>
                <Button onClick={() => navigate('/portal')} className="mt-6">Back to Portal</Button>
            </div>
        );
    }

    const availableTerms = [
        { id: 'portal', title: 'Portal Terms of Agreement', content: activeOrg.customerTerms || '' },
        { id: 'general', title: 'General Terms & Conditions', content: activeOrg.termsAndConditions || '' },
        { id: 'proposal', title: 'Proposal Terms of Agreement', content: activeOrg.proposalTerms || '' },
        { id: 'disclaimer', title: 'Proposal Disclaimer', content: activeOrg.proposalDisclaimer || '' },
        { id: 'nda', title: 'Proposal NDA Agreement', content: activeOrg.proposalNdaContent || '' },
        { id: 'invoice', title: 'Invoice Terms', content: activeOrg.invoiceTerms || '' },
        { id: 'membership', title: 'Membership Terms', content: activeOrg.membershipTerms || '' },
        { id: 'warranty', title: 'Warranty Disclaimer', content: activeOrg.warrantyDisclaimer || '' },
    ].filter(t => t.content && t.content.trim() !== '');

    const activeTerm = availableTerms.find(t => t.id === activeTab) || availableTerms[0];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-10rem)] bg-slate-50 dark:bg-slate-950 font-sans">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-6 mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/portal')}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{activeOrg.name} Legal Agreements</h1>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Review organizational policies & customer terms</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {activeCustomer && !activeCustomer.agreedToCustomerTerms ? (
                        <Button 
                            onClick={handleAcceptAll}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2"
                        >
                            <Check size={18} /> Agree & Accept All Terms
                        </Button>
                    ) : (
                        <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
                            <Check size={14} /> Agreed on {activeCustomer?.customerTermsAgreedAt ? new Date(activeCustomer.customerTermsAgreedAt).toLocaleDateString() : 'File'}
                        </div>
                    )}
                </div>
            </div>

            {availableTerms.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700 max-w-xl mx-auto shadow-sm">
                    <FileText size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">No active terms found</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">This organization hasn't published any legal terms or agreements yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Sidebar Tabs */}
                    <div className="lg:col-span-1 space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Available Agreements</div>
                        {availableTerms.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-between cursor-pointer ${
                                    activeTab === t.id
                                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 shadow-sm border-l-4 border-indigo-650'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white border border-transparent border-slate-200/50 dark:border-slate-700/50'
                                }`}
                            >
                                <span className="truncate">{t.title}</span>
                            </button>
                        ))}
                    </div>

                    {/* Right Terms Content */}
                    <div className="lg:col-span-3">
                        {activeTerm && (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                                {/* Header bar of content */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <FileText size={18} className="text-slate-400" />
                                        <h3 className="font-black text-slate-800 dark:text-white text-base">{activeTerm.title}</h3>
                                    </div>
                                    <button
                                        onClick={() => handlePrint(activeTerm.title, activeTerm.content)}
                                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                        title="Print Document"
                                    >
                                        <Printer size={16} /> Print
                                    </button>
                                </div>

                                {/* Main Text Scrollable Box */}
                                <div className="p-6 md:p-8 overflow-y-auto max-h-[60vh] flex-grow text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed custom-scrollbar bg-white dark:bg-slate-800">
                                    {activeTerm.content}
                                </div>

                                {/* Footer bar */}
                                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500 flex justify-between items-center">
                                    <span>Terms active for {activeOrg.name}</span>
                                    {activeCustomer?.agreedToCustomerTerms && (
                                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                            <Check size={12} /> Accepted
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrganizationTerms;
