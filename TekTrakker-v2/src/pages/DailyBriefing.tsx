
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Card from 'components/ui/Card';
import { 
    ClipboardList, CheckSquare, Play, MapPinIcon, CalendarDays, Navigation, ChevronRight, FileText, Clock, AlertCircle
} from 'lucide-react';
import type { Job, Project, ProjectTask, User } from 'types';
import { formatAddress , cleanUndefinedFields } from 'lib/utils';
import { globalConfirm } from 'lib/globalConfirm';

import WeatherWidget from './briefing/components/WeatherWidget';
import ProjectTaskWorkflowModal from './briefing/components/ProjectTaskWorkflowModal';
import JobWorkflowModal from './briefing/components/JobWorkflowModal';
import LocationPhotosLayoutModal from 'components/modals/LocationPhotosLayoutModal';
import SubcontractorWorkOrderModal from 'components/modals/SubcontractorWorkOrderModal';

import { db } from 'lib/firebase';
import showToast from 'lib/toast';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Button from 'components/ui/Button';

const ALL_INDUSTRIES = ['HVAC', 'Plumbing', 'Electrical', 'Appliance Repair', 'Locksmith', 'Handyman', 'Cleaning', 'Pest Control', 'Landscaping', 'Roofing', 'Painting', 'General Contracting'];

const JobCard: React.FC<{ 
    job: Job; 
    customer?: any; 
    users: any[]; 
    onOpen: () => void;
    onOpenLayout?: (location: any) => void;
}> = ({ job, customer, users, onOpen, onOpenLayout }) => {
    const { t } = useLanguage();
    const { state } = useAppContext();
    
    const isSubcontractor = state.currentUser?.role === 'Subcontractor';
    const displayCustomerName = isSubcontractor 
        ? `${t("Job")} #${job.poNumber || job.id.slice(-6).toUpperCase()}` 
        : (customer?.name || job.customerName);
    
    const resolvedAddress = useMemo(() => {
        if (job.locationId && customer?.serviceLocations) {
            const loc = customer.serviceLocations.find((l: any) => l.id === job.locationId);
            if (loc?.address) return loc.address;
        }
        return job.address || customer?.address || '';
    }, [job, customer]);

    const loc = useMemo(() => {
        if (job.locationId && customer?.serviceLocations) {
            return customer.serviceLocations.find((l: any) => l.id === job.locationId);
        }
        return null;
    }, [job, customer]);

    const timeStr = job.appointmentTime ? new Date(job.appointmentTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    const isEnRoute = job.transitStartTime && !job.checkInTime;
    const isInProgress = job.jobStatus === 'In Progress';
    const isCompleted = job.jobStatus === 'Completed';

    return (
    <div className="w-full mb-3.5 overflow-hidden border border-slate-200 dark:border-slate-700/70 shadow-sm rounded-2xl bg-white dark:bg-slate-800 transition-all hover:border-primary-400 active:scale-[0.99] touch-manipulation group" data-tour="tech-route-jobs">
        <button 
            type="button" 
            className="w-full text-left p-4 cursor-pointer focus:outline-none" 
            onClick={onOpen}
        >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        {timeStr && (
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/40">
                                {timeStr}
                            </span>
                        )}
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wide ${
                            isCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60' : 
                            isInProgress ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60' : 
                            job.jobStatus === 'Needs Follow-up' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60' : 
                            isEnRoute ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                            {isEnRoute ? t("En Route") : t(job.jobStatus || 'Scheduled')}
                        </span>
                        {job.assignedPartnerId && (
                            <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">{t("Partner")}</span>
                        )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate leading-snug">
                        {displayCustomerName}
                    </h3>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 truncate">
                        <MapPinIcon size={14} className="shrink-0 text-slate-400 dark:text-slate-500"/> {formatAddress(resolvedAddress)}
                    </p>

                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                         {job.tasks.map((t, i) => (
                             <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 font-semibold">
                                 {t}
                             </span>
                         ))}
                         {(job.assistants || []).length > 0 && (
                              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md text-indigo-600 dark:text-indigo-400 font-semibold">
                                {t("Crew")}: {(job.assistants || []).map(id => {
                                    const u = users.find(user => user.id === id);
                                    return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
                                }).join(', ')}
                              </span>
                         )}
                    </div>
                </div>

                <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700/50 shrink-0">
                    <div className="min-h-[44px] px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 w-full sm:w-auto">
                        {isEnRoute ? (
                            <>
                                <Navigation size={16} className="animate-bounce" />
                                <span>{t("En Route")}</span>
                            </>
                        ) : isInProgress ? (
                            <>
                                <Play size={16} className="animate-pulse" />
                                <span>{t("In Progress")}</span>
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                <span>{t("Open Job")}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </button>

        {loc && (loc.photos?.length > 0 || loc.layoutPhotoUrl) && (
            <div className="px-4 pb-3 pt-2 flex gap-2 items-center border-t border-slate-100 dark:border-slate-700/50 w-full bg-slate-50/50 dark:bg-slate-800/40" onClick={(e) => e.stopPropagation()}>
                {loc.photos && loc.photos.length > 0 && (
                    <div className="flex gap-1 overflow-x-auto py-0.5 custom-scrollbar max-w-[180px] shrink-0">
                        {loc.photos.map((pUrl: string, idx: number) => (
                            <img key={idx} src={pUrl} alt="Location thumbnail" className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                        ))}
                    </div>
                )}
                {loc.layoutPhotoUrl && onOpenLayout && (
                    <button 
                        type="button"
                        onClick={() => onOpenLayout(loc)}
                        className="min-h-[36px] text-xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 hover:bg-emerald-100 transition-all ml-auto active:scale-95 cursor-pointer touch-manipulation"
                    >
                        <MapPinIcon size={12} /> {t("View Floor Plan")}
                    </button>
                )}
            </div>
        )}
    </div>
);
};

const DailyBriefing: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const { currentUser, jobs, externalJobs, projects, activeJobIdForWorkflow } = state;
    const [selectedLocationForLayout, setSelectedLocationForLayout] = useState<any>(null);
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [layoutJobId, setLayoutJobId] = useState<string | null>(null);
    const [autoOpenAssetId, setAutoOpenAssetId] = useState<string | null>(null);
    const navigate = useNavigate();
    const [selectedTaskData, setSelectedTaskData] = useState<{task: ProjectTask, project: Project} | null>(null);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [viewingWorkOrderId, setViewingWorkOrderId] = useState<string | null>(null);
    // Subcontractor crew states
    const [isAddTechModalOpen, setIsAddTechModalOpen] = useState(false);
    const [newTechFirstName, setNewTechFirstName] = useState('');
    const [newTechLastName, setNewTechLastName] = useState('');
    const [newTechEmail, setNewTechEmail] = useState('');
    const [newTechPhone, setNewTechPhone] = useState('');
    const [isSavingTech, setIsSavingTech] = useState(false);

    const myCrew = useMemo(() => {
        if (!currentUser) return [];
        return state.users.filter(u => 
            u.subcontractorId === currentUser.id && 
            u.status !== 'archived'
        );
    }, [state.users, currentUser]);

    const handleAddTech = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        const normalizedEmail = newTechEmail.trim().toLowerCase();
        if (!newTechFirstName || !newTechLastName || !normalizedEmail) {
            showToast.warn("Please fill in all required fields.");
            return;
        }

        setIsSavingTech(true);
        try {
            const existingUserDoc = await db.collection('users').doc(normalizedEmail).get();
            if (existingUserDoc.exists) {
                showToast.warn("A user with this email already exists.");
                setIsSavingTech(false);
                return;
            }

            const newTechId = normalizedEmail;
            const newTechData = {
                id: newTechId,
                email: normalizedEmail,
                firstName: newTechFirstName.trim(),
                lastName: newTechLastName.trim(),
                phone: newTechPhone.trim() || null,
                role: 'Technician',
                status: 'active',
                organizationId: currentUser.organizationId,
                subcontractorId: currentUser.id,
                payRate: 0,
                ptoAccrued: 0,
                createdAt: new Date().toISOString()
            };

            await db.collection('users').doc(newTechId).set(cleanUndefinedFields(newTechData));
            showToast.success("Technician added to your crew successfully!");
            setIsAddTechModalOpen(false);
            setNewTechFirstName('');
            setNewTechLastName('');
            setNewTechEmail('');
            setNewTechPhone('');
        } catch (err: any) {
            console.error("Failed to add technician:", err);
            showToast.error("Failed to add technician: " + err.message);
        } finally {
            setIsSavingTech(false);
        }
    };

    const handleRemoveTech = async (techId: string, name: string) => {
        if (await globalConfirm(`Are you sure you want to remove ${name} from your crew? This will deactivate their account.`)) {
            try {
                await db.collection('users').doc(techId).update(cleanUndefinedFields({
                    status: 'archived',
                    subcontractorId: null
                }));
                showToast.success(`${name} removed successfully.`);
            } catch (err: any) {
                console.error("Failed to remove technician:", err);
                showToast.error("Failed to remove: " + err.message);
            }
        }
    };

    const handleDispatchJob = async (jobId: string, techId: string) => {
        try {
            if (techId === 'self') {
                await db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
                    assignedTechnicianId: currentUser?.id,
                    assignedTechnicianName: `${currentUser?.firstName} ${currentUser?.lastName}`,
                    subcontractorId: currentUser?.id
                }));
                showToast.success("Job assigned to yourself.");
            } else {
                const targetTech = state.users.find(u => u.id === techId);
                if (!targetTech) return;
                await db.collection('jobs').doc(jobId).update(cleanUndefinedFields({
                    assignedTechnicianId: targetTech.id,
                    assignedTechnicianName: `${targetTech.firstName} ${targetTech.lastName}`,
                    subcontractorId: currentUser?.id
                }));
                showToast.success(`Job dispatched to ${targetTech.firstName}.`);
            }
        } catch (err: any) {
            console.error("Failed to dispatch job:", err);
            showToast.error("Failed to dispatch job: " + err.message);
        }
    };
    
    // Upgrade flow states
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [upgradeCompanyName, setUpgradeCompanyName] = useState('');
    const [upgradePhone, setUpgradePhone] = useState('');
    const [upgradeTrade, setUpgradeTrade] = useState('HVAC');
    const [upgradeAddress, setUpgradeAddress] = useState('');
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [upgradePlan, setUpgradePlan] = useState<'starter' | 'growth' | 'enterprise' | 'payments_only'>('starter');

    const handleUpgradeAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        if (!upgradeCompanyName.trim()) {
            showToast.warn("Please enter your Company Name.");
            return;
        }

        setIsUpgrading(true);
        try {
            const newOrgId = `org-${Date.now()}`;
            const expiryDate = upgradePlan === 'payments_only' ? null : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const subStatus = upgradePlan === 'payments_only' ? 'active' : 'trial';
            
            const newOrgData = {
                id: newOrgId,
                name: upgradeCompanyName.trim(),
                phone: upgradePhone.trim() || currentUser.phone || '',
                email: currentUser.email || '',
                address: upgradeAddress.trim() as any,
                primaryVertical: upgradeTrade as any,
                ownerId: currentUser.id,
                subscriptionStatus: subStatus as any,
                plan: upgradePlan,
                subscriptionExpiryDate: expiryDate,
                settings: {
                    publicProfile: true
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 1. Create Organization doc
            await db.collection('organizations').doc(newOrgId).set(cleanUndefinedFields(newOrgData));

            // 2. Upgrade User account doc (preserve ID)
            await db.collection('users').doc(currentUser.id).update(cleanUndefinedFields({
                organizationId: newOrgId,
                role: 'admin', // Upgrade to Admin
                status: 'active',
                upgradedFromSubcontractor: true,
                upgradedAt: new Date().toISOString()
            }));

            showToast.success("Congratulations! Your account has been upgraded and your business registered.");
            setIsUpgradeModalOpen(false);
            
            // Dispatch to context so layout updates instantly
            dispatch({
                type: 'LOGIN_SUCCESS',
                payload: {
                    user: {
                        ...currentUser,
                        organizationId: newOrgId,
                        role: 'admin' as any,
                        status: 'active' as any
                    },
                    organization: newOrgData,
                    isMasterAdmin: false
                }
            });

            // Redirect to admin dashboard
            navigate('/admin/dashboard', { replace: true });
        } catch (err: any) {
            console.error("Upgrade failed:", err);
            showToast.error("Failed to upgrade account: " + err.message);
        } finally {
            setIsUpgrading(false);
        }
    };

    const activeJob = useMemo(() => {
        if (!activeJobId) return null;
        const allJobs = [...(jobs || []), ...(externalJobs || [])];
        return allJobs.find(j => j.id === activeJobId) || null;
    }, [jobs, externalJobs, activeJobId]);

    const viewingWorkOrder = useMemo(() => {
        if (!viewingWorkOrderId) return null;
        const allJobs = [...(jobs || []), ...(externalJobs || [])];
        return allJobs.find(j => j.id === viewingWorkOrderId) || null;
    }, [jobs, externalJobs, viewingWorkOrderId]);

    const pendingWorkOrders = useMemo(() => {
        if (!currentUser) return [];
        const combinedJobs = [...(jobs || []), ...(externalJobs || [])];
        return combinedJobs.filter(j => {
            const isAssigned = j.assignedTechnicianId === currentUser.id || 
                               (j.assignedCrew && j.assignedCrew.includes(currentUser.id)) ||
                               (j.assistants && j.assistants.includes(currentUser.id)) ||
                               (currentUser.role === 'Subcontractor' && j.subcontractorId === currentUser.id);
            const isNotCompleted = j.jobStatus !== 'Completed' && j.jobStatus !== 'Cancelled';
            const hasWorkOrder = !!j.subcontractorWorkOrder;
            const isPending = hasWorkOrder && (j.subcontractorWorkOrder.status === 'pending' || !j.subcontractorWorkOrder.status);
            return isAssigned && isNotCompleted && isPending;
        });
    }, [jobs, externalJobs, currentUser]);

    const groupedJobs = useMemo(() => {
        if (!currentUser) return { today: [], tomorrow: [], upcoming: [] };
        
        const combinedJobs = [...(jobs || []), ...(externalJobs || [])];

        const now = new Date();
        const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        const startOfNextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).getTime();
        const startOfNextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).getTime();

        const myActiveJobs = combinedJobs.filter(j => {
            const isAssigned = j.assignedTechnicianId === currentUser.id || 
                               (j.assignedCrew && j.assignedCrew.includes(currentUser.id)) ||
                               (j.assistants && j.assistants.includes(currentUser.id)) ||
                               (currentUser.role === 'Subcontractor' && j.subcontractorId === currentUser.id);
            const isNotCompleted = j.jobStatus !== 'Completed' && j.jobStatus !== 'Cancelled';
            
            // Subcontractor workorders: only show in active schedule if accepted
            const hasWorkOrder = !!j.subcontractorWorkOrder;
            const isAccepted = hasWorkOrder ? j.subcontractorWorkOrder.status === 'accepted' : true;
            
            return isAssigned && isNotCompleted && isAccepted;
        });

        const groups: { today: Job[], tomorrow: Job[], upcoming: Job[] } = {
            today: [],
            tomorrow: [],
            upcoming: []
        };

        myActiveJobs.forEach(job => {
            let jobTimeStr = job.appointmentTime;
            if (jobTimeStr && !jobTimeStr.includes('T')) {
                // Fix for date-only strings being parsed as UTC midnight
                jobTimeStr = `${jobTimeStr}T12:00:00`;
            } else if (jobTimeStr && jobTimeStr.endsWith('T00:00:00.000Z')) {
                // Fix for ISO strings generated at UTC midnight but intended for local day
                jobTimeStr = jobTimeStr.replace('T00:00:00.000Z', 'T12:00:00');
            }
            const jobTime = new Date(jobTimeStr).getTime();
            
            if (isNaN(jobTime)) return;

            if (jobTime < startOfTomorrow) {
                groups.today.push(job);
            } else if (jobTime >= startOfTomorrow && jobTime < startOfNextDay) {
                groups.tomorrow.push(job);
            } else if (jobTime >= startOfNextDay && jobTime < startOfNextWeek) {
                groups.upcoming.push(job);
            }
        });

        const sortByTime = (a: Job, b: Job) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime();
        groups.today.sort(sortByTime);
        groups.tomorrow.sort(sortByTime);
        groups.upcoming.sort(sortByTime);

        return groups;
    }, [jobs, externalJobs, currentUser]);

    // This effect handles re-opening the workflow modal after returning from proposal creation
    useEffect(() => {
        if (activeJobIdForWorkflow) {
            const allMyJobs = [...groupedJobs.today, ...groupedJobs.tomorrow, ...groupedJobs.upcoming];
            const jobToOpen = allMyJobs.find(j => j.id === activeJobIdForWorkflow);
            if (jobToOpen) {
                setActiveJobId(jobToOpen.id);
                // Clear the trigger so it doesn't re-open on every render
                dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: null });
            }
        }
    }, [activeJobIdForWorkflow, groupedJobs, dispatch]);

    const myTasks = useMemo(() => {
        if (!currentUser || !projects) return [];
        const list: {task: ProjectTask, project: Project}[] = [];
        (projects || []).forEach(p => {
            if (p.projectTasks) {
                p.projectTasks.forEach(t => {
                    if (t.assignedTo === currentUser.id && t.status !== 'Completed') {
                        list.push({ task: t, project: p });
                    }
                });
            }
        });
        return list;
    }, [projects, currentUser]);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? t('Good morning') : hour < 17 ? t('Good afternoon') : t('Good evening');
    
    const totalJobs = groupedJobs.today.length + groupedJobs.tomorrow.length + groupedJobs.upcoming.length;

    return (
        <div className="p-4 pb-24 max-w-3xl mx-auto space-y-5 animate-fade-in">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{greeting}, {currentUser?.firstName}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {totalJobs > 0 ? `${totalJobs} ${totalJobs > 1 ? t('jobs') : t('job')} ${t('on your schedule this week')}` : t("No jobs scheduled — you're clear")}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                </div>
            </header>

            {currentUser && currentUser.role === 'Subcontractor' && (
                <div className="bg-gradient-to-r from-teal-500 to-indigo-600 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-left">
                        <h2 className="text-xl font-black">Upgrade Your Subcontractor Account</h2>
                        <p className="text-xs text-slate-100 max-w-2xl">
                            Ready to register your own business? Upgrade your account to register your organization, configure pricing, and accept direct dispatch work orders!
                        </p>
                    </div>
                    <button 
                        onClick={() => setIsUpgradeModalOpen(true)}
                        className="bg-white text-indigo-700 hover:bg-slate-100 h-10 px-4 shrink-0 w-full md:w-auto font-black uppercase text-xs tracking-wider rounded-xl transition-all"
                    >
                        Register My Business
                    </button>
                </div>
            )}

            {currentUser && currentUser.role === 'Subcontractor' && (currentUser as any).signedAgreements && (
                <Card className="border-l-4 border-indigo-500 text-left">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {t("My Active Contracts & Agreements")}
                    </h3>
                    <div className="space-y-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">{t("Non-Disclosure Agreement (NDA)")}</p>
                                <p className="text-xs text-slate-500">{t("Signed via digital signature:")} <span className="font-mono text-indigo-600 dark:text-indigo-400">{(currentUser as any).signedAgreementsSignature}</span></p>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full">{t("Active")}</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">{t("Non-Compete & Non-Solicitation Agreement")}</p>
                                <p className="text-xs text-slate-500">{t("Signed via digital signature:")} <span className="font-mono text-indigo-600 dark:text-indigo-400">{(currentUser as any).signedAgreementsSignature}</span></p>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full">{t("Active")}</span>
                        </div>
                    </div>
                </Card>
            )}

            {currentUser && currentUser.role === 'Subcontractor' && (
                <Card className="border-l-4 border-indigo-500 text-left">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {t("My Crew & Dispatch")}
                        </h3>
                        <button 
                            onClick={() => setIsAddTechModalOpen(true)}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1"
                        >
                            + {t("Add Technician")}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {myCrew.map(tech => {
                            const activeJob = state.jobs.find(j => 
                                j.assignedTechnicianId === tech.id && 
                                j.jobStatus !== 'Completed' && 
                                j.jobStatus !== 'Cancelled'
                            );
                            
                            return (
                                <div key={tech.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 flex justify-between items-center gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-slate-800 dark:text-white">{tech.firstName} {tech.lastName}</p>
                                        <p className="text-xs text-slate-500 truncate">{tech.email} &bull; {tech.phone || t('No phone')}</p>
                                        
                                        {activeJob ? (
                                            <p className="text-xs font-semibold text-indigo-650 dark:text-indigo-400 mt-1 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                                {t("On Job")} #{activeJob.poNumber || activeJob.id.slice(-6).toUpperCase()} - {activeJob.customerName}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-slate-400 mt-1 italic">{t("Idle / Available")}</p>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveTech(tech.id, `${tech.firstName} ${tech.lastName}`)}
                                        className="text-xs font-bold text-red-650 hover:text-red-750 px-2.5 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors border border-transparent hover:border-red-200/50"
                                    >
                                        {t("Fire")}
                                    </button>
                                </div>
                            );
                        })}
                        
                        {myCrew.length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-750">
                                {t("You haven't added any technicians to your crew yet.")}
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Pending Work Orders Section */}
            {pendingWorkOrders.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/10 dark:to-orange-950/10 border border-amber-250 dark:border-amber-900/60 rounded-3xl p-6 space-y-4 shadow-sm text-left">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <FileText size={20} className="animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-amber-900 dark:text-amber-300">
                                    {t("New Work Orders Pending Approval")}
                                </h3>
                                <p className="text-xs text-amber-600 dark:text-amber-500">
                                    {t("Review and accept/decline new work order assignments")}
                                </p>
                            </div>
                        </div>
                        <span className="text-xs font-black text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-350 px-3 py-1 rounded-full animate-bounce">
                            {pendingWorkOrders.length} {t("NEW")}
                        </span>
                    </div>

                    <div className="space-y-3">
                        {pendingWorkOrders.map(job => {
                            const customer = state.customers?.find(c => c.id === job.customerId);
                            const resolvedAddress = job.address || customer?.address || '';
                            return (
                                <button 
                                    key={job.id} 
                                    onClick={() => setViewingWorkOrderId(job.id)} 
                                    className="w-full text-left p-4 bg-white dark:bg-slate-800 rounded-2xl border border-amber-200 dark:border-amber-900/30 hover:border-amber-450 active:scale-[0.99] transition-all flex justify-between items-center group shadow-sm hover:shadow-md"
                                >
                                    <div className="min-w-0 flex-1 pr-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                                                {t("Work Order")} #{job.poNumber || job.id.slice(-6).toUpperCase()}
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-450 bg-amber-55/40 px-2 py-0.5 rounded-md">
                                                {t("Awaiting Acceptance")}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-450 truncate mt-1">
                                            {customer?.name || job.customerName} &bull; {formatAddress(resolvedAddress)}
                                        </p>
                                        {job.subcontractorWorkOrder?.nte && (
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                                                NTE Limit: <span className="text-amber-600 dark:text-amber-400 font-bold">${Number(job.subcontractorWorkOrder.nte).toFixed(2)}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-colors shadow-sm shadow-amber-500/20">
                                        {t("Review")} <ChevronRight size={14} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <WeatherWidget />

            <div className="grid grid-cols-2 gap-4 mb-2">
                <button 
                  onClick={() => navigate('/briefing/scheduling')}
                  className="col-span-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors text-emerald-700 dark:text-emerald-400 font-bold shadow-sm"
                >
                    <CalendarDays className="w-5 h-5 flex-shrink-0" />
                    {t("View My Full Schedule")}
                </button>
            </div>

            {myTasks.length > 0 && (
                <Card className="mb-6 border-l-4 border-purple-500">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <ClipboardList size={20} className="text-purple-600"/> {t("Assigned Project Tasks")}
                    </h3>
                    <div className="space-y-3">
                        {myTasks.map(({task, project}) => (
                            <button key={task.id} onClick={() => setSelectedTaskData({task, project})} className="w-full text-left p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-purple-400 transition-colors flex justify-between items-center group">
                                <div><p className="font-bold text-slate-800 dark:text-white">{task.description}</p><p className="text-xs text-slate-500">{project.name}</p></div>
                                <div className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">{t("Update")}</div>
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
                <button 
                  onClick={() => navigate('/briefing/hr?tab=safety')}
                  className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors text-red-700 dark:text-red-400 font-bold shadow-sm"
                >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    {t("Report Incident")}
                </button>
                <button 
                  onClick={() => navigate('/briefing/hr')}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors text-blue-700 dark:text-blue-400 font-bold shadow-sm"
                >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    {t("HR & Handbooks")}
                </button>
            </div>

            <div className="space-y-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4"><CheckSquare size={20} className="text-blue-500" /> {t("Today's Schedule")}</h2>                    {groupedJobs.today.length > 0 ? (
                        groupedJobs.today.map(job => (
                            <div key={job.id} className="mb-3">
                                <JobCard job={job} customer={state.customers?.find(c => c.id === job.customerId)} users={state.users} onOpen={() => setActiveJobId(job.id)} onOpenLayout={(loc) => { setSelectedLocationForLayout(loc); setLayoutJobId(job.id); setIsLayoutModalOpen(true); }} />
                                {currentUser?.role === 'Subcontractor' && (
                                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-b-xl -mt-5 mb-2 border-x border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs relative z-10">
                                        <span className="font-bold text-slate-550 dark:text-slate-400">{t("Dispatch Crew")}:</span>
                                        <select 
                                            value={job.assignedTechnicianId === currentUser.id ? 'self' : (job.assignedTechnicianId || 'self')} 
                                            onChange={(e) => handleDispatchJob(job.id, e.target.value)}
                                            className="bg-white dark:bg-slate-755 border border-slate-250 dark:border-slate-650 rounded-lg p-1.5 font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                                        >
                                            <option value="self">{t("Assign to Myself")}</option>
                                            {myCrew.map(tech => (
                                                <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                            <p className="text-slate-800 dark:text-white font-bold mb-1">{t("No Active Work Orders")}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                                {currentUser?.role === 'Subcontractor' 
                                    ? t("Your assigned work orders and jobs will appear here once dispatched by your sponsoring organization.")
                                    : t("No jobs scheduled for today.")}
                            </p>
                        </div>
                    )}
                </div>

                {groupedJobs.tomorrow.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4"><CalendarDays size={20} className="text-emerald-500"/> {t("Tomorrow")}</h2>
                        {groupedJobs.tomorrow.map(job => (
                            <div key={job.id} className="mb-3">
                                <JobCard job={job} customer={state.customers?.find(c => c.id === job.customerId)} users={state.users} onOpen={() => setActiveJobId(job.id)} onOpenLayout={(loc) => { setSelectedLocationForLayout(loc); setLayoutJobId(job.id); setIsLayoutModalOpen(true); }} />
                                {currentUser?.role === 'Subcontractor' && (
                                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-b-xl -mt-5 mb-2 border-x border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs relative z-10">
                                        <span className="font-bold text-slate-550 dark:text-slate-400">{t("Dispatch Crew")}:</span>
                                        <select 
                                            value={job.assignedTechnicianId === currentUser.id ? 'self' : (job.assignedTechnicianId || 'self')} 
                                            onChange={(e) => handleDispatchJob(job.id, e.target.value)}
                                            className="bg-white dark:bg-slate-755 border border-slate-250 dark:border-slate-650 rounded-lg p-1.5 font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                                        >
                                            <option value="self">{t("Assign to Myself")}</option>
                                            {myCrew.map(tech => (
                                                <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {groupedJobs.upcoming.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4"><CalendarDays size={20} className="text-slate-400"/> {t("Later This Week")}</h2>
                        {groupedJobs.upcoming.map(job => {
                            const dayName = new Date(job.appointmentTime).toLocaleDateString(undefined, { weekday: 'long' });
                            return (
                                <div key={job.id} className="relative mb-3">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 mt-4 ml-1">{dayName}</div>
                                    <JobCard job={job} customer={state.customers?.find(c => c.id === job.customerId)} users={state.users} onOpen={() => setActiveJobId(job.id)} onOpenLayout={(loc) => { setSelectedLocationForLayout(loc); setLayoutJobId(job.id); setIsLayoutModalOpen(true); }} />
                                    {currentUser?.role === 'Subcontractor' && (
                                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-b-xl -mt-5 mb-2 border-x border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs relative z-10">
                                            <span className="font-bold text-slate-550 dark:text-slate-400">{t("Dispatch Crew")}:</span>
                                            <select 
                                                value={job.assignedTechnicianId === currentUser.id ? 'self' : (job.assignedTechnicianId || 'self')} 
                                                onChange={(e) => handleDispatchJob(job.id, e.target.value)}
                                                className="bg-white dark:bg-slate-755 border border-slate-250 dark:border-slate-650 rounded-lg p-1.5 font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                                            >
                                                <option value="self">{t("Assign to Myself")}</option>
                                                {myCrew.map(tech => (
                                                    <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {totalJobs === 0 && (
                     <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <CheckSquare size={28} className="text-slate-400" />
                        </div>
                        <p className="text-slate-800 dark:text-white font-bold mb-1">{t("All Clear For The Week")}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                            {currentUser?.role === 'Subcontractor'
                                ? t("No subcontractor dispatches or work orders are scheduled for this week.")
                                : t("All clear for the week!")}
                        </p>
                    </div>
                )}
            </div>
            
            {activeJob && (
                <JobWorkflowModal 
                    job={activeJob} 
                    isOpen={!!activeJob} 
                    onClose={() => setActiveJobId(null)} 
                    onUpdate={(updatedJob) => dispatch({ type: 'UPDATE_JOB', payload: updatedJob })} 
                    initialEditingAssetId={autoOpenAssetId}
                    onClearInitialEditingAsset={() => setAutoOpenAssetId(null)}
                />
            )}

            {selectedLocationForLayout && (
                <LocationPhotosLayoutModal 
                    isOpen={isLayoutModalOpen}
                    onClose={() => {
                        setIsLayoutModalOpen(false);
                        setSelectedLocationForLayout(null);
                        setLayoutJobId(null);
                    }}
                    customerId={selectedLocationForLayout.customerId || (activeJob ? activeJob.customerId : '')}
                    locationId={selectedLocationForLayout.id}
                    isTechView={true}
                    onSelectEquipment={(eq) => {
                        setIsLayoutModalOpen(false);
                        setSelectedLocationForLayout(null);
                        setAutoOpenAssetId(eq.id);
                        if (layoutJobId) {
                            setActiveJobId(layoutJobId);
                        }
                    }}
                />
            )}
            
            {selectedTaskData && <ProjectTaskWorkflowModal isOpen={!!selectedTaskData} onClose={() => setSelectedTaskData(null)} task={selectedTaskData.task} project={selectedTaskData.project} /> }

            {isUpgradeModalOpen && (
                <Modal 
                    isOpen={isUpgradeModalOpen} 
                    onClose={() => setIsUpgradeModalOpen(false)} 
                    title="Register Your Business & Upgrade Account"
                >
                    <form onSubmit={handleUpgradeAccount} className="space-y-4 text-left">
                        <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                            Upgrading will register your new business organization while keeping your current login credentials. All your signed documents, historical jobs, and agreements will remain intact.
                        </p>
                        
                        <Input 
                            label="Business / Company Name" 
                            value={upgradeCompanyName} 
                            onChange={e => setUpgradeCompanyName(e.target.value)} 
                            required 
                            placeholder="e.g. Apex Mechanical Services"
                        />
                        
                        <Input 
                            label="Business Phone Number" 
                            type="tel"
                            value={upgradePhone} 
                            onChange={e => setUpgradePhone(e.target.value)} 
                            placeholder="e.g. (555) 019-2834"
                        />
                        
                        <Select 
                            label="Primary Trade / Industry Vertical" 
                            value={upgradeTrade} 
                            onChange={e => setUpgradeTrade(e.target.value)}
                        >
                            {ALL_INDUSTRIES.map(ind => (
                                <option key={ind} value={ind}>{ind}</option>
                            ))}
                        </Select>
                        
                        <Input 
                            label="Business Address" 
                            value={upgradeAddress} 
                            onChange={e => setUpgradeAddress(e.target.value)} 
                            placeholder="e.g. 123 Main St, Suite A, Dallas, TX 75201"
                        />

                        <Select 
                            label="Subscription Plan (includes 14-day free trial)" 
                            value={upgradePlan} 
                            onChange={e => setUpgradePlan(e.target.value as any)}
                        >
                            <option value="starter">Starter Plan ($99/mo) — Up to 5 Users/Techs, Core Dispatch & Invoicing</option>
                            <option value="growth">Growth Plan ($249/mo) — Up to 15 Users/Techs, Advanced Marketing & Estimator</option>
                            <option value="enterprise">Enterprise Plan ($499/mo) — Unlimited Users, Custom Branding & Dedicated Support</option>
                            <option value="payments_only">Payments-Only Plan (Free base fee, pay-per-transaction only)</option>
                        </Select>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={() => setIsUpgradeModalOpen(false)}
                                disabled={isUpgrading}
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isUpgrading}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isUpgrading ? 'Upgrading...' : 'Upgrade & Register'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {viewingWorkOrder && (
                <SubcontractorWorkOrderModal 
                    isOpen={!!viewingWorkOrderId} 
                    onClose={() => setViewingWorkOrderId(null)} 
                    job={viewingWorkOrder} 
                />
            )}

            {isAddTechModalOpen && (
                <Modal 
                    isOpen={isAddTechModalOpen} 
                    onClose={() => setIsAddTechModalOpen(false)} 
                    title={t("Add Crew Technician")}
                >
                    <form onSubmit={handleAddTech} className="space-y-4 text-left">
                        <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                            {t("Create a login account for your technician. They will only see jobs you dispatch to them, and cannot see billing or sensitive settings.")}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label={t("First Name")} 
                                value={newTechFirstName} 
                                onChange={e => setNewTechFirstName(e.target.value)} 
                                required 
                            />
                            <Input 
                                label={t("Last Name")} 
                                value={newTechLastName} 
                                onChange={e => setNewTechLastName(e.target.value)} 
                                required 
                            />
                        </div>
                        
                        <Input 
                            label={t("Email (Username)")} 
                            type="email"
                            value={newTechEmail} 
                            onChange={e => setNewTechEmail(e.target.value)} 
                            required 
                            placeholder="tech@example.com"
                        />
                        
                        <Input 
                            label={t("Phone Number")} 
                            type="tel"
                            value={newTechPhone} 
                            onChange={e => setNewTechPhone(e.target.value)} 
                            placeholder="(555) 019-2834"
                        />

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-6">
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={() => setIsAddTechModalOpen(false)}
                                disabled={isSavingTech}
                            >
                                {t("Cancel")}
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isSavingTech}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isSavingTech ? t('Saving...') : t('Add Technician')}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default DailyBriefing;
