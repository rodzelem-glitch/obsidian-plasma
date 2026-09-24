import showToast from "lib/toast";
import { cleanUndefinedFields } from 'lib/utils';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import type { PlatformLead, CommissionSettings, Organization, User, PlatformCommission, SalesIncentiveContest } from '../../types';
import { DollarSign, Briefcase, Users, PieChart, FileText, Download, PlayCircle, User as UserIcon, ArrowLeft, Trophy, Gift, Award, Zap, TrendingUp, Sparkles, CheckCircle2, Target, Calendar, Clock, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmployeeProfileModal from '../../components/modals/EmployeeProfileModal';
import SignaturePad, { SignaturePadHandle } from '../../components/ui/SignaturePad';
import { MOCK_DEMO_LEADS } from '../../lib/mockDemoData';
import DOMPurify from 'dompurify';
import { generateSalesRepContractHtml, formatContractWithSignature, DEFAULT_COMMISSION_RULES } from '../../utils/salesContractGenerator';
import SalesScenarioCalculator from '../../components/sales/SalesScenarioCalculator';

const SalesOverview: React.FC = () => {
    const { state, dispatch, startDemo } = useAppContext();
    const { currentUser, isDemoMode } = state;
    const navigate = useNavigate();
    const [leads, setLeads] = useState<PlatformLead[]>([]);
    const [commissions, setCommissions] = useState<PlatformCommission[]>([]);
    const [activeIncentive, setActiveIncentive] = useState<SalesIncentiveContest | null>(null);
    const [viewContract, setViewContract] = useState(false);
    const [commissionRules, setCommissionRules] = useState<CommissionSettings | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

    const sigPadRef = useRef<SignaturePadHandle>(null);
    const [isSigning, setIsSigning] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        if (isDemoMode) {
            setLeads(MOCK_DEMO_LEADS as PlatformLead[]);
            setCommissionRules(DEFAULT_COMMISSION_RULES);
            return;
        }

        const unsub = db.collection('platformLeads')
            .where('repId', '==', currentUser.id)
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as PlatformLead));
                setLeads(data);
            }, (error) => {
                console.error("Firestore error:", error);
            });

        const unsubComms = db.collection('platformCommissions')
            .where('repId', '==', currentUser.id)
            .onSnapshot(snap => {
                const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as PlatformCommission));
                setCommissions(data);
            }, (error) => {
                console.error("Firestore error:", error);
            });
            
        db.collection('settings').doc('commission_rules').get().then(doc => {
            if (currentUser.customCommissionSettings) {
                setCommissionRules(currentUser.customCommissionSettings);
                if (currentUser.customCommissionSettings.activeMonthlyIncentive) {
                    setActiveIncentive(currentUser.customCommissionSettings.activeMonthlyIncentive);
                }
            } else if (doc.exists) {
                const rules = doc.data() as CommissionSettings;
                setCommissionRules(rules);
                if (rules.activeMonthlyIncentive) {
                    setActiveIncentive(rules.activeMonthlyIncentive);
                }
            } else {
                setCommissionRules(DEFAULT_COMMISSION_RULES);
            }
        });

        db.collection('settings').doc('active_sales_incentive').get().then(doc => {
            if (doc.exists) {
                setActiveIncentive(doc.data() as SalesIncentiveContest);
            }
        });
            
        return () => { unsub(); unsubComms(); };
    }, [currentUser, isDemoMode]);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthWonLeads = useMemo(() => {
        return leads.filter(l => {
            if (l.status !== 'Closed Won') return false;
            const d = new Date(l.updatedAt || l.createdAt || 0);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
    }, [leads, currentYear, currentMonth]);

    const currentMonthComms = useMemo(() => {
        return commissions.filter(c => {
            const d = new Date(c.dateEarned || c.createdAt || 0);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
    }, [commissions, currentYear, currentMonth]);

    const monthMrr = useMemo(() => {
        if (currentMonthComms.length > 0) {
            return currentMonthComms.reduce((sum, c: any) => sum + (c.mrrValue !== undefined ? c.mrrValue : (c.isAnnual ? (c.baseAmount / 12) : c.baseAmount)), 0);
        }
        return currentMonthWonLeads.reduce((sum, l) => sum + ((l.value || 0) / 12), 0);
    }, [currentMonthComms, currentMonthWonLeads]);

    // Accelerator Bracket calculation:
    const currentAccelerator = useMemo(() => {
        if (monthMrr >= 2500) {
            return { tier: 3, rate: 0.30, label: '30.0% Top Producer Accelerator', nextTier: null, mrrToNext: 0, progressPct: 100 };
        } else if (monthMrr >= 2000) {
            const mrrToNext = 2500 - monthMrr;
            const progressPct = 50 + ((monthMrr - 2000) / 500) * 50;
            return { tier: 2, rate: 0.275, label: '27.5% Tier 1 Accelerator', nextTier: '30.0%', mrrToNext, progressPct };
        } else {
            const mrrToNext = 2000 - monthMrr;
            const progressPct = Math.min(50, (monthMrr / 2000) * 50);
            return { tier: 1, rate: 0.25, label: '25.0% Standard Base Rate', nextTier: '27.5%', mrrToNext, progressPct };
        }
    }, [monthMrr]);

    // Performance Cash Bonus calculation:
    const currentBonusTier = useMemo(() => {
        const tiers = [
            { mrr: 10000, bonus: 7500 },
            { mrr: 7500, bonus: 4000 },
            { mrr: 5000, bonus: 2500 },
            { mrr: 4000, bonus: 1500 },
            { mrr: 3000, bonus: 1000 },
            { mrr: 2000, bonus: 500 },
            { mrr: 1000, bonus: 250 }
        ];

        const earned = tiers.find(t => monthMrr >= t.mrr);
        const next = [...tiers].reverse().find(t => monthMrr < t.mrr);

        return {
            earnedBonus: earned ? earned.bonus : 0,
            earnedMrr: earned ? earned.mrr : 0,
            nextBonus: next ? next.bonus : null,
            nextMrr: next ? next.mrr : null,
            mrrToNextBonus: next ? next.mrr - monthMrr : 0
        };
    }, [monthMrr]);

    // Active Contest evaluation for this representative:
    const repContestStatus = useMemo(() => {
        if (!activeIncentive || !activeIncentive.isActive) return null;
        const start = new Date(activeIncentive.startDate).getTime();
        const end = new Date(activeIncentive.endDate + 'T23:59:59').getTime();
        const nowMs = Date.now();
        const daysLeft = Math.max(0, Math.ceil((end - nowMs) / (1000 * 60 * 60 * 24)));

        // Filter won leads and commissions within contest window
        const contestWins = leads.filter(l => {
            if (l.status !== 'Closed Won') return false;
            const t = new Date(l.updatedAt || l.createdAt || 0).getTime();
            return t >= start && t <= end;
        });

        const contestComms = commissions.filter(c => {
            const t = new Date(c.dateEarned || c.createdAt || 0).getTime();
            return t >= start && t <= end;
        });

        const contestMrr = contestComms.length > 0
            ? contestComms.reduce((sum, c: any) => sum + (c.mrrValue !== undefined ? c.mrrValue : (c.isAnnual ? (c.baseAmount / 12) : c.baseAmount)), 0)
            : contestWins.reduce((sum, l) => sum + ((l.value || 0) / 12), 0);

        const dealsCount = contestWins.length;
        const raffleTickets = dealsCount;

        let isQualified = false;
        let progressLabel = '';
        let targetProgressPct = 0;

        if (activeIncentive.criteriaType === 'threshold_volume') {
            const target = activeIncentive.targetThreshold || 2500;
            isQualified = contestMrr >= target;
            progressLabel = isQualified ? 'Target MRR Cleared!' : `$${Math.max(0, target - contestMrr).toFixed(2)} away from qualification`;
            targetProgressPct = Math.min(100, (contestMrr / target) * 100);
        } else if (activeIncentive.criteriaType === 'threshold_deals') {
            const target = activeIncentive.targetThreshold || 5;
            isQualified = dealsCount >= target;
            progressLabel = isQualified ? 'Target Deals Hit!' : `${Math.max(0, target - dealsCount)} more deals to qualify`;
            targetProgressPct = Math.min(100, (dealsCount / target) * 100);
        } else if (activeIncentive.criteriaType === 'raffle') {
            isQualified = raffleTickets > 0;
            progressLabel = `${raffleTickets} Raffle Entry Ticket${raffleTickets === 1 ? '' : 's'} Earned`;
            targetProgressPct = raffleTickets > 0 ? 100 : 0;
        } else {
            isQualified = dealsCount > 0;
            progressLabel = `${dealsCount} Deals Closed ($${contestMrr.toFixed(2)} MRR)`;
            targetProgressPct = dealsCount > 0 ? 100 : 0;
        }

        return {
            daysLeft,
            contestMrr,
            dealsCount,
            raffleTickets,
            isQualified,
            progressLabel,
            targetProgressPct
        };
    }, [activeIncentive, leads, commissions]);

    const metrics = useMemo(() => {
        const totalPipeline = leads.reduce((sum, l) => sum + (l.status !== 'Closed Lost' ? (l.value || 0) : 0), 0);
        const closedWon = leads.filter(l => l.status === 'Closed Won').reduce((sum, l) => sum + (l.value || 0), 0);
        const openLeads = leads.filter(l => !['Closed Won', 'Closed Lost'].includes(l.status)).length;
        const rate = currentAccelerator.rate;
        const projectedCommission = closedWon * rate; 
        return { totalPipeline, closedWon, openLeads, projectedCommission };
    }, [leads, currentAccelerator]);
    
    const handleLaunchDemo = () => {
        // Use the centralized startDemo system
        startDemo('admin');
    };

    const displayedContractHtml = useMemo(() => {
        if (!currentUser) return '';
        const effectiveRules = currentUser.customCommissionSettings || commissionRules || DEFAULT_COMMISSION_RULES;
        const baseHtml = currentUser.customCommissionSettings 
            ? generateSalesRepContractHtml(currentUser, effectiveRules)
            : (currentUser.salesContractContent || generateSalesRepContractHtml(currentUser, effectiveRules));
        return currentUser.salesContractSigned 
            ? formatContractWithSignature(baseHtml, currentUser)
            : baseHtml;
    }, [currentUser, commissionRules]);

    const handlePrintContract = () => {
        if (!currentUser || !displayedContractHtml) return;
        const win = window.open('', '_blank');
        if (win) {
            const sanitizedBody = DOMPurify.sanitize(displayedContractHtml);
            win.document.write(`<html><head><title>Sales Representative Agreement - ${currentUser.firstName} ${currentUser.lastName}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; line-height: 1.6; max-width: 850px; margin: 0 auto; }</style></head><body>${sanitizedBody}</body></html>`);
            win.document.close();
            setTimeout(() => { win.focus(); win.print(); }, 400);
        }
    };

    const handleSignContract = async () => {
        if (!currentUser || !sigPadRef.current || sigPadRef.current.isEmpty()) { 
            showToast.warn("Please provide your digital signature."); 
            return; 
        }
        
        if (isDemoMode) {
            showToast.warn("Contract signing is disabled in Demo Mode.");
            return;
        }

        setIsSigning(true);
        try {
            const signature = sigPadRef.current.toDataURL();
            const effectiveRules = currentUser.customCommissionSettings || commissionRules || DEFAULT_COMMISSION_RULES;
            const rawContent = generateSalesRepContractHtml(currentUser, effectiveRules);
            const updateData = { 
                salesContractSigned: true, 
                salesContractDate: new Date().toISOString(), 
                salesContractSignature: signature, 
                salesContractContent: DOMPurify.sanitize(rawContent) 
            };
            await db.collection('users').doc(currentUser.id).update(cleanUndefinedFields(updateData));
            dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...currentUser, ...updateData } as User & { id: string } });
            showToast.success("Independent Sales Representative Agreement signed and accepted!");
        } catch (e) { 
            showToast.error("Failed to save agreement signature."); 
        } finally { 
            setIsSigning(false); 
        }
    };

    if (!currentUser) return null;

    return (
        <div className="space-y-6 pb-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Sales Overview</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setIsSimulatorOpen(true)} className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-sm">
                        <Calculator size={15}/> Simulator
                    </Button>
                    <Button onClick={handleLaunchDemo} className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-700">
                        <PlayCircle size={16}/> Launch Demo
                    </Button>
                    <Button onClick={() => setViewContract(true)} variant="secondary" className="flex items-center gap-2 text-xs">
                        <FileText size={16}/> Contract
                    </Button>
                    <Button onClick={() => setIsProfileModalOpen(true)} variant="secondary" className="flex items-center gap-2 text-xs">
                        <UserIcon size={16}/> Profile
                    </Button>
                </div>
            </header>

            {!currentUser?.salesContractSigned && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-4 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-xl shrink-0">
                            <FileText size={22} />
                        </div>
                        <div>
                            <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">Independent Sales Representative Agreement Pending Signature</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Please review and electronically sign your sales agreement to activate commission disbursements.</p>
                        </div>
                    </div>
                    <Button onClick={() => setViewContract(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 px-4 whitespace-nowrap shadow-sm">
                        Review & Sign Agreement
                    </Button>
                </div>
            )}

            {/* ACTIVE MONTHLY SPOTLIGHT CONTEST / SPIFF BANNER */}
            {repContestStatus && activeIncentive && (
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                        <div className="space-y-2 max-w-2xl">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/30 text-amber-100">
                                    <Sparkles size={14} className="text-yellow-300 animate-pulse" /> Active Monthly Spiff & Contest
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/90 bg-black/20 px-2.5 py-1 rounded-full">
                                    <Clock size={13} /> {repContestStatus.daysLeft > 0 ? `${repContestStatus.daysLeft} days remaining` : 'Ends today!'}
                                </span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{activeIncentive.title}</h2>
                            <p className="text-sm text-white/90 leading-relaxed">{activeIncentive.description}</p>
                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">Spotlight Reward:</span>
                                <span className="bg-white text-slate-900 text-xs font-black px-3 py-1 rounded-lg shadow-sm">
                                    🎁 {activeIncentive.rewardValue}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-xl w-full lg:w-80 shrink-0 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-white/90">
                                <span className="flex items-center gap-1"><Trophy size={14} className="text-yellow-300"/> Your Qualification</span>
                                {repContestStatus.isQualified ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wide">
                                        Qualified ✓
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded bg-white/20 text-white font-medium text-[10px] uppercase tracking-wide">
                                        In Progress
                                    </span>
                                )}
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-semibold text-white/80 mb-1">
                                    <span>{repContestStatus.progressLabel}</span>
                                    <span>{repContestStatus.dealsCount} deals</span>
                                </div>
                                <div className="w-full bg-black/30 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-yellow-300 h-full rounded-full transition-all duration-500" 
                                        style={{ width: `${Math.max(5, Math.min(100, repContestStatus.targetProgressPct))}%` }}
                                    ></div>
                                </div>
                            </div>
                            {activeIncentive.criteriaType === 'raffle' && (
                                <div className="text-[11px] text-amber-100 flex items-center gap-1">
                                    🎟️ Every closed deal earns 1 raffle ticket entry for the final drawing!
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-emerald-50 border-emerald-200 p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/sales/commissions')}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-200 text-emerald-700 rounded-full"><DollarSign size={24}/></div>
                        <div><p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Closed Revenue</p><p className="text-3xl font-black text-emerald-900">${metrics.closedWon.toLocaleString()}</p></div>
                    </div>
                </Card>
                <Card className="bg-blue-50 border-blue-200 p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/sales/pipeline')}>
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-200 text-blue-700 rounded-full"><Briefcase size={24}/></div>
                        <div><p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Pipeline Value</p><p className="text-3xl font-black text-blue-900">${metrics.totalPipeline.toLocaleString()}</p></div>
                    </div>
                </Card>
                <Card className="bg-purple-50 border-purple-200 p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/sales/commissions')}>
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-200 text-purple-700 rounded-full"><PieChart size={24}/></div>
                        <div><p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Est. Commission</p><p className="text-3xl font-black text-purple-900">${metrics.projectedCommission.toLocaleString()}</p></div>
                    </div>
                </Card>
                <Card className="bg-slate-50 border-slate-200 p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => navigate('/sales/leads')}>
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-200 text-slate-700 rounded-full"><Users size={24}/></div>
                        <div><p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Open Leads</p><p className="text-3xl font-black text-slate-900">{metrics.openLeads}</p></div>
                    </div>
                </Card>
            </div>

            {/* MONTHLY ACCELERATOR & PERFORMANCE CASH BONUS METER */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ACCELERATOR CARD */}
                <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                    <Zap size={18} />
                                </span>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">Monthly New-MRR Accelerator</h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">First-year commission rate scales automatically as your month's collected MRR rises.</p>
                        </div>
                        <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-400 block uppercase">Current Rate</span>
                            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                                {(currentAccelerator.rate * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    {/* Accelerator Tier Progress Bar */}
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-600 dark:text-slate-400">Current Month New MRR: <strong className="text-slate-900 dark:text-white font-mono">${monthMrr.toFixed(2)}</strong></span>
                            {currentAccelerator.nextTier ? (
                                <span className="text-blue-600 dark:text-blue-400">
                                    ${currentAccelerator.mrrToNext.toFixed(2)} to {currentAccelerator.nextTier} Accelerator
                                </span>
                            ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Top 30% Accelerator Active!</span>
                            )}
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden flex">
                            <div 
                                className="bg-blue-500 h-full transition-all duration-500 rounded-full" 
                                style={{ width: `${Math.max(4, Math.min(100, currentAccelerator.progressPct))}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 font-semibold px-0.5">
                            <span>$0 (25.0%)</span>
                            <span>$2,000 (27.5%)</span>
                            <span>$2,500+ (30.0%)</span>
                        </div>
                    </div>

                    {/* Annual Prepayment Kicker Notice */}
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-emerald-600 shrink-0"/>
                            <div>
                                <span className="font-bold text-emerald-900 dark:text-emerald-200 block">+5% Annual Subscription Prepayment Kicker</span>
                                <span className="text-emerald-700 dark:text-emerald-400 text-[11px]">Customers selecting annual plans boost your commission rate by +5 percentage points!</span>
                            </div>
                        </div>
                        <span className="font-black text-emerald-700 dark:text-emerald-300 font-mono text-sm px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 rounded">
                            +5.0%
                        </span>
                    </div>
                </Card>

                {/* PERFORMANCE CASH BONUS CARD */}
                <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                    <Award size={18} />
                                </span>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base">Monthly Cash Performance Bonus</h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Paid in cash on top of regular commissions (highest tier achieved paid).</p>
                        </div>
                        <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-400 block uppercase">Unlocked Bonus</span>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                ${currentBonusTier.earnedBonus.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Milestone Targets List */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3 text-center">
                        {(currentUser.customCommissionSettings?.monthlyMrrBonuses || commissionRules?.monthlyMrrBonuses || DEFAULT_COMMISSION_RULES.monthlyMrrBonuses!).map(tier => {
                            const isPassed = monthMrr >= tier.mrr;
                            const isCurrent = currentBonusTier.earnedMrr === tier.mrr;
                            return (
                                <div 
                                    key={tier.mrr} 
                                    className={`p-1.5 rounded-lg border text-[11px] transition-all ${
                                        isCurrent 
                                            ? 'bg-emerald-600 text-white border-emerald-700 font-black shadow-sm ring-2 ring-emerald-400' 
                                            : isPassed 
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold' 
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    <div className="text-[10px] opacity-75">${tier.mrr >= 1000 ? `${tier.mrr / 1000}k` : tier.mrr}</div>
                                    <div className="font-bold font-mono">${tier.bonus}</div>
                                </div>
                            );
                        })}
                    </div>

                    {currentBonusTier.nextBonus ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-center justify-between text-xs">
                            <span className="text-amber-800 dark:text-amber-300 font-medium">
                                Next milestone: Close <strong>${currentBonusTier.mrrToNextBonus.toFixed(2)}</strong> more MRR to unlock the <strong>${currentBonusTier.nextBonus.toLocaleString()}</strong> bonus!
                            </span>
                            <span className="px-2 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold rounded text-[11px]">
                                In Reach
                            </span>
                        </div>
                    ) : (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            🎉 Maximum Monthly Cash Bonus Tier Unlocked!
                        </div>
                    )}
                </Card>
            </div>

            {/* EARNINGS SIMULATOR TEASER CARD */}
            <Card className="p-6 border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/40 dark:from-slate-900 dark:to-blue-950/20 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shrink-0">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">What-If Commission & Residuals Simulator</h3>
                                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">Interactive Tool</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Model how many monthly deals and annual upfront contracts it takes to reach your income goals ($50k, $100k, $250k+) and project your long-term passive residual checks.</p>
                        </div>
                    </div>
                    <Button onClick={() => setIsSimulatorOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 whitespace-nowrap self-start md:self-auto shadow-sm">
                        <Calculator size={14} /> Launch Simulator
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="h-96 flex flex-col justify-center items-center text-slate-400 border-2 border-dashed">
                    <PieChart size={48} className="mb-4 opacity-50"/>
                    <p className="font-bold">Performance Analytics</p>
                    <p className="text-xs">Detailed revenue charts will appear here as data accumulates.</p>
                </Card>
                 <Card className="h-96 overflow-y-auto">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">Recent Activity</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm text-slate-500 text-center italic">Activity log will populate as you engage with leads.</div>
                    </div>
                </Card>
            </div>

            <Modal isOpen={viewContract} onClose={() => setViewContract(false)} title="Independent Sales Representative Agreement" size="lg">
                <div className="space-y-4 flex flex-col h-[80vh]">
                    <div className="bg-white dark:bg-slate-900 border rounded-xl p-4 md:p-8 shadow-inner flex-1 overflow-y-auto text-sm leading-relaxed custom-scrollbar">
                        {currentUser ? (
                            <div dangerouslySetInnerHTML={{ 
                                __html: DOMPurify.sanitize(displayedContractHtml) 
                            }} />
                        ) : (
                            <div className="text-center p-8 text-gray-500">Loading agreement...</div>
                        )}
                    </div>
                    {!currentUser?.salesContractSigned && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border rounded-xl space-y-2">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Digital Signature:</p>
                            <p className="text-xs text-slate-500">By signing below, you agree to the terms, commission schedule, and non-commissionable metered usage policies outlined in this Agreement.</p>
                            <SignaturePad ref={sigPadRef} className="h-28 bg-white dark:bg-slate-900 border rounded-lg" />
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-3 border-t">
                        {currentUser?.salesContractSigned ? (
                            <Button variant="secondary" onClick={handlePrintContract} className="flex items-center gap-2"><Download size={16} /> Print Agreement</Button>
                        ) : (
                            <Button onClick={handleSignContract} disabled={isSigning} className="bg-emerald-600 hover:bg-emerald-700 font-bold">{isSigning ? 'Saving Signature...' : 'Accept & Sign Agreement'}</Button>
                        )}
                        <Button variant="secondary" onClick={() => setViewContract(false)}>Close</Button>
                    </div>
                </div>
            </Modal>
            
            {isProfileModalOpen && <EmployeeProfileModal isOpen={true} onClose={() => setIsProfileModalOpen(false)} employee={currentUser} isSelf={true} />}

            {isSimulatorOpen && (
                <Modal 
                    isOpen={true} 
                    onClose={() => setIsSimulatorOpen(false)} 
                    title="Interactive Sales Earnings & Residuals Simulator" 
                    size="xl"
                >
                    <div className="p-2 max-h-[80vh] overflow-y-auto">
                        <SalesScenarioCalculator 
                            rules={currentUser.customCommissionSettings || commissionRules || DEFAULT_COMMISSION_RULES} 
                            repName={`${currentUser.firstName} ${currentUser.lastName}`}
                            isModal={true} 
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SalesOverview;
