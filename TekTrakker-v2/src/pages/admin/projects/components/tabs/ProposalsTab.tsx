import { cleanUndefinedFields } from '../../../../../lib/utils';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import { FileText, Eye, Send, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import type { Project, Proposal } from 'types';
import showToast from 'lib/toast';
import { db } from 'lib/firebase';

interface ProposalsTabProps {
    project: Project;
}

const ProposalsTab: React.FC<ProposalsTabProps> = ({ project }) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const navigate = useNavigate();

    // Filter project-level proposals related to this project
    const projectProposals = useMemo(() => {
        return (state.proposals || []).filter(
            (p: Proposal) => p.isProjectLevel && p.projectId === project.id
        );
    }, [state.proposals, project.id]);

    const stats = useMemo(() => {
        const total = projectProposals.reduce((sum, p) => sum + (p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0), 0);
        const accepted = projectProposals.filter(p => p.status === 'Accepted').reduce((sum, p) => sum + (p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0), 0);
        return { total, accepted, count: projectProposals.length };
    }, [projectProposals]);

    const handleCreateProposal = () => {
        navigate(`/admin/project-proposals?create=true&projectId=${project.id}&customerId=${project.customerId}`);
    };

    const handleViewProposal = (proposalId: string) => {
        navigate(`/admin/project-proposals?editId=${proposalId}`);
    };

    const formatCurrency = (n: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    };

    const handleVerbalAccept = async (proposal: any) => {
        if (!window.confirm(t("Are you sure you want to mark this proposal as verbally accepted?"))) {
            return;
        }
        
        try {
            const signedAtStr = new Date().toISOString();
            const signerName = "Verbal Acceptance (Recorded by Admin)";
            const updatedHistory = [
                ...(proposal.trackingHistory || []),
                {
                    status: 'Accepted',
                    timestamp: signedAtStr,
                    updatedBy: state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}` : 'Admin',
                    notes: `Proposal verbally accepted. Recorded by ${state.currentUser ? `${state.currentUser.firstName} ${state.currentUser.lastName}` : 'Admin'}`
                }
            ];

            let updatePayload: any = {
                status: 'Accepted',
                signatureDataUrl: 'VERBAL_ACCEPTANCE',
                signatureName: signerName,
                signedAt: signedAtStr,
                trackingHistory: updatedHistory,
                updatedAt: signedAtStr
            };

            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields(updatePayload));
            showToast.success(t("Proposal marked as verbally accepted."));
        } catch (e: any) {
            console.error("Error verbally accepting proposal:", e);
            showToast.error(t("Failed to accept proposal: ") + e.message);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in mt-4">
            <div className="flex justify-between items-center">
                <div className="flex gap-4">
                    <Card className="py-2 px-4 bg-slate-50 dark:bg-slate-800 border-l-4 border-indigo-500 shadow-sm flex items-center gap-2">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("Total Bidded")}</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(stats.total)}</p>
                        </div>
                    </Card>
                    <Card className="py-2 px-4 bg-slate-50 dark:bg-slate-800 border-l-4 border-emerald-500 shadow-sm flex items-center gap-2">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("Accepted Value")}</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(stats.accepted)}</p>
                        </div>
                    </Card>
                </div>
                <Button onClick={handleCreateProposal} className="flex items-center gap-2 shadow-lg">
                    <Sparkles size={16} />
                    {t("Create Project Proposal")}
                </Button>
            </div>

            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-lg rounded-2xl">
                <Table headers={[t('Date'), t('Proposal ID'), t('Title'), t('PO / SCID'), t('Total Value'), t('Status'), t('Actions')]}>
                    {projectProposals.map((p) => {
                        const val = p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0;
                        return (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all">
                                <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                                    {new Date(p.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">
                                    #{p.id.slice(-6).toUpperCase()}
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">
                                    {p.title || t("Project Pricing Proposal")}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                                    {p.poNumber || p.scid || p.invoiceId ? (
                                        <span className="flex flex-col gap-0.5">
                                            {p.poNumber && (
                                                <button
                                                    onClick={() => dispatch({ type: 'SET_VIEWING_WORK_ORDER', payload: { workOrderNumber: p.poNumber, customerId: p.customerId || null } })}
                                                    className="hover:underline transition cursor-pointer text-left font-sans text-xs text-slate-550 dark:text-slate-450 border-none bg-transparent p-0 w-max"
                                                >
                                                    PO: {p.poNumber}
                                                </button>
                                            )}
                                            {p.scid && <span className="text-[10px]">SCID: {p.scid}</span>}
                                            {p.invoiceId && (
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                                    Invoice: #{p.invoiceId.toUpperCase()}
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="italic text-slate-400">--</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                                    {formatCurrency(val)}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                                            p.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                            p.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                            p.status === 'Opened' ? 'bg-indigo-100 text-indigo-800' :
                                            (p.status === 'Declined' || p.status === 'Denied') ? 'bg-rose-100 text-rose-800' :
                                            p.status === 'Expired' ? 'bg-slate-200 text-slate-800' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                            {p.status}
                                        </span>
                                        {(() => {
                                            const hasBeenOpened = p.status === 'Opened' || p.trackingHistory?.some((entry: any) => entry.status === 'Opened');
                                            return hasBeenOpened && p.status !== 'Accepted' && (
                                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 flex items-center gap-1">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
                                                    {t("Opened")}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button 
                                            title={t("View/Edit Proposal")} 
                                            aria-label={t("View/Edit Proposal")} 
                                            onClick={() => handleViewProposal(p.id)} 
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                                        >
                                            <Eye size={16}/>
                                        </button>
                                        <a 
                                            href={`/#/project-proposal-view/${p.id}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            title={t("Public View")} 
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                                        >
                                            <FileText size={16}/>
                                        </a>
                                        {p.status !== 'Accepted' && (
                                            <button 
                                                title={t("Verbal Accept")} 
                                                aria-label={t("Verbal Accept")} 
                                                onClick={() => handleVerbalAccept(p)} 
                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-amber-600 transition-colors"
                                            >
                                                <CheckCircle size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {projectProposals.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-400 font-medium italic">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <AlertCircle size={24} className="text-slate-300" />
                                    <span>{t("No proposals linked to this project yet.")}</span>
                                </div>
                            </td>
                        </tr>
                    )}
                </Table>
            </Card>
        </div>
    );
};

export default ProposalsTab;
