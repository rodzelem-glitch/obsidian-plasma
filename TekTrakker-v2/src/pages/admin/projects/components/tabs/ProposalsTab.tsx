import { cleanUndefinedFields, matchTier } from '../../../../../lib/utils';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import { FileText, Eye, Send, Sparkles, AlertCircle, CheckCircle, Download, Link2, Unlink, Search, X } from 'lucide-react';
import type { Project, Proposal } from 'types';
import showToast from 'lib/toast';
import { db } from 'lib/firebase';
import { globalConfirm } from 'lib/globalConfirm';

interface ProposalsTabProps {
    project: Project;
}

const ProposalsTab: React.FC<ProposalsTabProps> = ({ project }) => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const navigate = useNavigate();

    // Import Proposals Modal States
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFilterMode, setImportFilterMode] = useState<'customer' | 'unassigned' | 'all'>('customer');
    const [importSearchTerm, setImportSearchTerm] = useState('');
    const [selectedPropIdsToImport, setSelectedPropIdsToImport] = useState<string[]>([]);
    const [isImporting, setIsImporting] = useState(false);

    // Filter project-level proposals related to this project
    const projectProposals = useMemo(() => {
        return (state.proposals || []).filter(
            (p: Proposal) => p.projectId === project.id || (p.isProjectLevel && p.projectId === project.id)
        );
    }, [state.proposals, project.id]);

    const availableProposalsToImport = useMemo(() => {
        return (state.proposals || []).filter(p => {
            if (p.projectId === project.id) return false;

            if (importFilterMode === 'customer') {
                return p.customerId === project.customerId || (p.customerName && p.customerName.toLowerCase() === project.customerName.toLowerCase());
            }

            if (importFilterMode === 'unassigned') {
                return !p.projectId;
            }

            return true;
        }).filter(p => {
            if (!importSearchTerm.trim()) return true;
            const term = importSearchTerm.toLowerCase();
            const num = (p.proposalNumber || p.id || '').toLowerCase();
            const title = (p.title || '').toLowerCase();
            const cust = (p.customerName || '').toLowerCase();
            const po = (p.poNumber || '').toLowerCase();
            return num.includes(term) || title.includes(term) || cust.includes(term) || po.includes(term);
        }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }, [state.proposals, project.id, project.customerId, project.customerName, importFilterMode, importSearchTerm]);

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

    const handleExecuteImportProposals = async () => {
        if (selectedPropIdsToImport.length === 0) return;
        setIsImporting(true);

        try {
            const batch = db.batch();
            const updatedProps: Proposal[] = [];

            for (const propId of selectedPropIdsToImport) {
                const targetProp = state.proposals.find(p => p.id === propId);
                if (targetProp) {
                    const updatePayload: Partial<Proposal> = {
                        projectId: project.id,
                        isProjectLevel: true,
                        updatedAt: new Date().toISOString()
                    };

                    batch.update(db.collection('proposals').doc(targetProp.id), cleanUndefinedFields(updatePayload));
                    updatedProps.push({ ...targetProp, projectId: project.id, isProjectLevel: true });
                }
            }

            await batch.commit();

            updatedProps.forEach(p => {
                dispatch({ type: 'UPDATE_PROPOSAL', payload: p });
            });

            showToast.success(t(`Successfully imported ${updatedProps.length} proposal(s) into ${project.name}.`));
            setSelectedPropIdsToImport([]);
            setIsImportModalOpen(false);
        } catch (err: any) {
            console.error("Import Proposals Error:", err);
            showToast.error(t("Failed to import proposals: ") + (err.message || 'Unknown error'));
        } finally {
            setIsImporting(false);
        }
    };

    const handleUnlinkProposal = async (proposal: Proposal) => {
        const propDisplay = proposal.proposalNumber ? `#${proposal.proposalNumber}` : `#${proposal.id.slice(-6).toUpperCase()}`;
        if (!await globalConfirm(
            t(`Unlink proposal ${propDisplay} from "${project.name}"? The proposal will NOT be deleted.`),
            t("Unlink Proposal from Project"),
            t("Unlink Proposal"),
            t("Cancel")
        )) {
            return;
        }

        try {
            await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                projectId: null,
                isProjectLevel: false,
                updatedAt: new Date().toISOString()
            }));

            const updatedProp = { ...proposal, projectId: null, isProjectLevel: false };
            dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProp });
            showToast.success(t(`Unlinked proposal ${propDisplay} from project.`));
        } catch (err: any) {
            console.error("Unlink Proposal Error:", err);
            showToast.error(t("Failed to unlink proposal: ") + (err.message || 'Error'));
        }
    };

    const handleExportProposalsCsv = () => {
        const headers = ['Date', 'Proposal #', 'Title', 'Customer', 'PO / SCID', 'Total Value ($)', 'Status', 'Invoice #'];
        const rows = projectProposals.map(p => {
            const val = p.recommendedRoundedTotal || p.calculatedTotal || p.total || 0;
            return [
                p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '',
                `"${p.proposalNumber || p.id}"`,
                `"${(p.title || 'Project Pricing Proposal').replace(/"/g, '""')}"`,
                `"${(p.customerName || project.customerName || '').replace(/"/g, '""')}"`,
                `"${(p.poNumber || p.scid || '').replace(/"/g, '""')}"`,
                val.toFixed(2),
                `"${p.status || 'Draft'}"`,
                `"${p.invoiceId || ''}"`
            ];
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Proposals.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast.success(t("Proposals exported to CSV."));
    };

    const formatCurrency = (n: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    };

    const handleVerbalAccept = async (proposal: any) => {
        if (!(await globalConfirm(t("Are you sure you want to mark this proposal as verbally accepted?"), t("Verbal Authorization"), t("Accept Proposal"), t("Cancel")))) {
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
            dispatch({ type: 'UPDATE_PROPOSAL', payload: { id: proposal.id, ...updatePayload } });

            if (proposal.jobId) {
                try {
                    const jobDoc = await db.collection('jobs').doc(proposal.jobId).get();
                    if (jobDoc.exists) {
                        const jobData = jobDoc.data();
                        const existingInvoice = jobData?.invoice || {};
                        const targetJobId = proposal.jobId || jobDoc.id || 'JOB';
                        const cleanJobSuffix = targetJobId.replace(/^JOB-?/i, '');
                        const invoiceId = existingInvoice.id || `INV-${cleanJobSuffix}`;
                        const invoiceNumber = existingInvoice.invoiceNumber || existingInvoice.number || cleanJobSuffix;

                        const selectedTier = proposal.selectedOption || 'Basic';
                        const rawItems = Array.isArray(proposal.items) ? proposal.items : [];
                        const hasTiers = rawItems.some((i: any) => i.tier);
                        const targetItems = hasTiers 
                            ? rawItems.filter((i: any) => matchTier(i.tier, selectedTier))
                            : rawItems;

                        const invoiceItems = targetItems.map((pItem: any) => ({
                            id: pItem.id || `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            name: pItem.name || pItem.description || 'Proposal Item',
                            description: pItem.description || pItem.name || 'Proposal Item',
                            details: pItem.details || pItem.description || '',
                            notes: pItem.notes || '',
                            scopeOfWork: pItem.scopeOfWork || '',
                            subItems: Array.isArray(pItem.subItems) ? pItem.subItems : [],
                            quantity: Number(pItem.quantity || 1),
                            unitPrice: Number(pItem.price || pItem.unitPrice || 0),
                            price: Number(pItem.price || pItem.unitPrice || 0),
                            total: Number(pItem.total || ((pItem.price || pItem.unitPrice || 0) * (pItem.quantity || 1))),
                            type: (pItem.type as any) || 'Part',
                            partCost: pItem.partCost,
                            laborHours: pItem.laborHours,
                            hourlyRate: pItem.hourlyRate,
                            margin: pItem.margin,
                            taxable: pItem.taxable !== false
                        }));

                        const updatedInvoice = {
                            ...existingInvoice,
                            id: invoiceId,
                            invoiceNumber: invoiceNumber,
                            number: invoiceNumber,
                            proposalId: proposal.id,
                            proposalNumber: proposal.proposalNumber || proposal.id,
                            poNumber: proposal.poNumber || existingInvoice.poNumber || jobData?.poNumber || jobData?.workOrderNumber || '',
                            recommendations: proposal.recommendations || existingInvoice.recommendations || '',
                            items: invoiceItems,
                            subtotal: proposal.subtotal || 0,
                            taxAmount: proposal.taxAmount || 0,
                            totalAmount: proposal.total || 0,
                            amount: proposal.total || 0,
                            status: existingInvoice.status || 'Unpaid'
                        };

                        const updatedJob = {
                            ...jobData,
                            id: proposal.jobId,
                            proposalId: proposal.id,
                            invoice: updatedInvoice,
                            updatedAt: new Date().toISOString()
                        };

                        await db.collection('jobs').doc(proposal.jobId).update(cleanUndefinedFields({
                            proposalId: proposal.id,
                            invoice: updatedInvoice,
                            updatedAt: new Date().toISOString()
                        }));
                        dispatch({ type: 'UPDATE_JOB', payload: updatedJob });

                        await db.collection('proposals').doc(proposal.id).update(cleanUndefinedFields({
                            invoiceId: invoiceId
                        }));
                    }
                } catch (jobErr) {
                    console.error("Error updating associated job in ProposalsTab:", jobErr);
                }
            }

            showToast.success(t("Proposal marked as verbally accepted."));
        } catch (e: any) {
            console.error("Error verbally accepting proposal:", e);
            showToast.error(t("Failed to accept proposal: ") + e.message);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                <div className="flex flex-wrap items-center gap-2">
                    <Button 
                        onClick={() => {
                            setSelectedPropIdsToImport([]);
                            setIsImportModalOpen(true);
                        }} 
                        variant="secondary" 
                        className="flex items-center gap-1.5 shadow-sm text-xs h-9 font-bold"
                    >
                        <Link2 size={15} />
                        {t("Import Proposal")}
                    </Button>
                    <Button 
                        onClick={handleExportProposalsCsv} 
                        variant="secondary" 
                        className="flex items-center gap-1.5 shadow-sm text-xs h-9"
                    >
                        <Download size={15} />
                        {t("Export (CSV)")}
                    </Button>
                    <Button onClick={handleCreateProposal} className="flex items-center gap-2 shadow-lg text-xs h-9 font-bold">
                        <Sparkles size={16} />
                        {t("Create Project Proposal")}
                    </Button>
                </div>
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
                                    #{p.proposalNumber || p.id}
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
                                        <button 
                                            title={t("Unlink from Project")} 
                                            aria-label={t("Unlink from Project")} 
                                            onClick={() => handleUnlinkProposal(p)} 
                                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                        >
                                            <Unlink size={16}/>
                                        </button>
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

            {/* Import Proposals Modal */}
            {isImportModalOpen && (
                <Modal
                    isOpen={isImportModalOpen}
                    onClose={() => !isImporting && setIsImportModalOpen(false)}
                    title={t("Import Existing Proposals into Project")}
                    size="lg"
                >
                    <div className="space-y-4 max-h-[75vh] overflow-y-auto p-1">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setImportFilterMode('customer')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                                        importFilterMode === 'customer'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                    }`}
                                >
                                    {t("Customer Proposals")} ({project.customerName})
                                </button>
                                <button
                                    onClick={() => setImportFilterMode('unassigned')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                                        importFilterMode === 'unassigned'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                    }`}
                                >
                                    {t("Unassigned Proposals")}
                                </button>
                                <button
                                    onClick={() => setImportFilterMode('all')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                                        importFilterMode === 'all'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                    }`}
                                >
                                    {t("All Proposals")}
                                </button>
                            </div>

                            <div className="relative w-full sm:w-60">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder={t("Filter proposals...")}
                                    value={importSearchTerm}
                                    onChange={(e) => setImportSearchTerm(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white w-full"
                                />
                            </div>
                        </div>

                        {/* List of selectable proposals */}
                        <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 max-h-[400px] overflow-y-auto">
                            {availableProposalsToImport.map(prop => {
                                const isChecked = selectedPropIdsToImport.includes(prop.id);
                                const isOtherProject = prop.projectId && prop.projectId !== project.id;
                                const otherProjName = isOtherProject ? (state.projects.find(p => p.id === prop.projectId)?.name || t('Another Project')) : null;
                                const propTotal = prop.recommendedRoundedTotal || prop.calculatedTotal || prop.total || 0;

                                return (
                                    <div
                                        key={prop.id}
                                        onClick={() => {
                                            setSelectedPropIdsToImport(prev => 
                                                isChecked ? prev.filter(id => id !== prop.id) : [...prev, prop.id]
                                            );
                                        }}
                                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                                            isChecked 
                                                ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40' 
                                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}} // handled by parent onClick
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                                        #{prop.proposalNumber || prop.id.slice(-6).toUpperCase()}
                                                    </span>
                                                    <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                                                        prop.status === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                                        prop.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {prop.status || 'Draft'}
                                                    </span>
                                                    {otherProjName && (
                                                        <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                                                            {t("Currently in:")} {otherProjName}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-xs text-slate-900 dark:text-white mt-1">
                                                    {prop.title || t('Project Pricing Proposal')}
                                                </p>
                                                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                                                    <span>{prop.customerName || project.customerName}</span>
                                                    {prop.poNumber && <span>&bull; PO: {prop.poNumber}</span>}
                                                    {prop.createdAt && <span>&bull; {new Date(prop.createdAt).toLocaleDateString()}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="font-black text-xs text-slate-900 dark:text-white">
                                                {formatCurrency(propTotal)}
                                            </p>
                                            {prop.invoiceId && (
                                                <p className="text-[10px] text-emerald-600 font-bold">
                                                    Inv: #{prop.invoiceId.toUpperCase()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {availableProposalsToImport.length === 0 && (
                                <div className="p-8 text-center text-slate-400 text-xs">
                                    {t("No available proposals found to import matching this filter.")}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                            <div className="text-xs text-slate-500">
                                <span className="font-bold">{selectedPropIdsToImport.length}</span> {t("proposals selected")}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsImportModalOpen(false)}
                                    disabled={isImporting}
                                    className="text-xs"
                                >
                                    {t("Cancel")}
                                </Button>
                                <Button
                                    onClick={handleExecuteImportProposals}
                                    disabled={isImporting || selectedPropIdsToImport.length === 0}
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 font-bold"
                                >
                                    {isImporting ? t("Importing...") : t(`Import ${selectedPropIdsToImport.length} Proposal(s)`)}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ProposalsTab;
