import { cleanUndefinedFields } from '../../lib/utils';
import React, { useMemo } from 'react';
import { FinancialIcon, UsersIcon, TimeLogIcon, AlertTriangle } from '../../constants/constants';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import type { Job, User, Appointment, ShiftLog } from '../../types/types';
import { db } from '../../lib/firebase';

import MetricCard from './dashboard/components/MetricCard';
import PendingAppointments from './dashboard/components/PendingAppointments';
import LiveOperations from './dashboard/components/LiveOperations';
import { ShoppingCart, Bot, ArrowRight, Wrench, ShieldCheck, CreditCard, Presentation, Sparkles, Calendar, Clock } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import showToast from "lib/toast";
import OnboardingTour, { useOnboardingTour } from '../../components/ui/OnboardingTour';

const AdminDashboard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const currentUser = state.currentUser;
    const isPaymentsOnly = state.currentOrganization?.plan === 'payments_only';
    
    // Shift tracking states and logic
    const userShiftLogs = useMemo(() => {
        if (!currentUser) return [];
        const logs = (state.shiftLogs[currentUser.id] || []).sort((a: any, b: any) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
        return logs;
    }, [state.shiftLogs, currentUser]);

    const activeShift = useMemo(() => {
        return userShiftLogs.find(log => !log.clockOut);
    }, [userShiftLogs]);

    const [elapsedTime, setElapsedTime] = React.useState('00:00:00');

    React.useEffect(() => {
        let interval: number;
        if (activeShift) {
            interval = window.setInterval(() => {
                const diff = new Date().getTime() - new Date(activeShift.clockIn).getTime();
                const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
                const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                setElapsedTime(`${h}:${m}:${s}`);
            }, 1000);
        } else {
            setElapsedTime('00:00:00');
        }
        return () => clearInterval(interval);
    }, [activeShift]);

    const handleClockIn = async () => {
        if (state.isDemoMode) {
            showToast.warn("This feature is disabled in demo mode.");
            return;
        }
        const activeOrgId = state.currentOrganization?.id || currentUser?.organizationId;
        if (!currentUser || !activeOrgId) {
            showToast.warn("Session error. Please log in again.");
            return;
        }

        let loc = null;
        try {
            const { getCurrentLocation } = await import('lib/geolocation');
            loc = await getCurrentLocation();
        } catch (err) {
            console.warn("Could not get geolocation", err);
        }

        const cleanUndefined = (obj: any) => {
            const copy = { ...obj };
            Object.keys(copy).forEach(k => {
                if (copy[k] === undefined) delete copy[k];
            });
            return copy;
        };

        const logId = `shift-${Date.now()}`;
        const newLog: ShiftLog = { 
            id: logId, 
            organizationId: activeOrgId,
            clockIn: new Date().toISOString(), 
            userId: currentUser.id,
            startLocation: loc ? { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy } : undefined
        };

        try {
            await db.collection('shiftLogs').doc(logId).set(cleanUndefinedFields(cleanUndefined(newLog)));
            dispatch({ type: 'ADD_SHIFT_LOG', payload: { userId: currentUser.id, log: newLog } });
            
            if (loc) {
                const locationData = { lat: loc.latitude, lng: loc.longitude, timestamp: new Date().toISOString() };
                await db.collection('users').doc(currentUser.id).update(cleanUndefinedFields({
                    location: locationData,
                    lastLocationUpdate: locationData.timestamp
                })).catch(err => console.error("Immediate clock-in sync failed:", err));
                
                dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...currentUser, location: locationData } });
            }

            showToast.success("Successfully clocked in!");
        } catch (e) {
            console.error(e);
            showToast.error("Clock-in failed.");
        }
    };

    const handleClockOut = async () => {
        if (state.isDemoMode) {
            showToast.warn("This feature is disabled in demo mode.");
            return;
        }
        if (activeShift && currentUser) {
            let loc = null;
            try {
                const { getCurrentLocation } = await import('lib/geolocation');
                loc = await getCurrentLocation();
            } catch (err) {
                console.warn("Could not get geolocation", err);
            }

            const cleanUndefined = (obj: any) => {
                const copy = { ...obj };
                Object.keys(copy).forEach(k => {
                    if (copy[k] === undefined) delete copy[k];
                });
                return copy;
            };

            const updatedLog = { 
                ...activeShift, 
                clockOut: new Date().toISOString(),
                endLocation: loc ? { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy } : undefined
            };
            try {
                await db.collection('shiftLogs').doc(activeShift.id).update(cleanUndefinedFields(cleanUndefined(updatedLog)));
                dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: currentUser.id, log: updatedLog } });
                
                if (loc) {
                    const locationData = { lat: loc.latitude, lng: loc.longitude, timestamp: new Date().toISOString() };
                    await db.collection('users').doc(currentUser.id).update(cleanUndefinedFields({
                        location: locationData,
                        lastLocationUpdate: locationData.timestamp
                    })).catch(err => console.error("Immediate clock-out sync failed:", err));
                    
                    dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...currentUser, location: locationData } });
                }

                showToast.success("Successfully clocked out!");
            } catch (e) {
                console.error(e);
                showToast.error("Clock-out failed.");
            }
        }
    };

    const [whiteboardStats, setWhiteboardStats] = React.useState({ tasks: 0, stickies: 0, photos: 0 });
    const [eventsCount, setEventsCount] = React.useState(0);
    React.useEffect(() => {
        if (isPaymentsOnly) return;
        const targetOrgId = state.currentOrganization?.id || currentUser?.organizationId;
        if (!targetOrgId) return;
        
        if (state.isDemoMode) {
            const localData = localStorage.getItem(`company_events_${targetOrgId}`);
            if (localData) {
                try {
                    setEventsCount(JSON.parse(localData).length);
                } catch {
                    setEventsCount(4);
                }
            } else {
                setEventsCount(4);
            }
        } else {
            const unsub = db.collection('events')
                .where('organizationId', '==', targetOrgId)
                .onSnapshot(s => {
                    setEventsCount(s.size);
                }, () => {});
            return () => unsub();
        }
    }, [state.currentOrganization?.id, currentUser?.organizationId, state.isDemoMode, isPaymentsOnly]);

    React.useEffect(() => {
        if (!state.currentOrganization?.id) return;
        const unsub = db.collection('whiteboards').doc(state.currentOrganization.id)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    const els = (data?.elements || []) as any[];
                    const tasks = els.filter(e => e.type === 'task').length;
                    const stickies = els.filter(e => e.type === 'sticky').length;
                    const photos = els.filter(e => e.type === 'photo').length;
                    setWhiteboardStats({ tasks, stickies, photos });
                }
            });
        return () => unsub();
    }, [state.currentOrganization?.id]);
    const hasCompletedMerchantSetup = !!state.currentOrganization?.kortAccountId;
    
    const employees = useMemo(() => {
        return (state.users as User[]).filter((u: User) => 
            u.organizationId === state.currentOrganization?.id && 
            (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor') &&
            (currentUser?.role !== 'supervisor' || u.reportsTo === currentUser?.id || u.id === currentUser?.id)
        );
    }, [state.users, state.currentOrganization, currentUser]);
    
    const filteredJobs = useMemo(() => {
        return (state.jobs as Job[]).filter(j => {
            const isRelevant = currentUser?.role !== 'supervisor' || 
                               (j.assignedTechnicianId && employees.some(e => e.id === j.assignedTechnicianId));
            return isRelevant;
        });
    }, [state.jobs, employees, currentUser]);
    
    const jobsInProgress = useMemo(() => {
        return filteredJobs.filter((j: Job) => j.jobStatus === 'In Progress').length;
    }, [filteredJobs]);
    
    const unpaidInvoices = useMemo(() => {
        return filteredJobs.filter((j: Job) => j.invoice?.status === 'Unpaid' || j.invoice?.status === 'Pending').length;
    }, [filteredJobs]);

    // Calculate Active Technicians based on online status
    const activeTechnicians = useMemo(() => {
        const now = new Date();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const FOUR_HOURS = 4 * 60 * 60 * 1000;

        return employees.filter(e => {
            const lastLogin = e.lastLoginAt ? new Date(e.lastLoginAt).getTime() : 0;
            const lastLoc = e.lastLocationUpdate ? new Date(e.lastLocationUpdate).getTime() : 0;
            
            const isRecentLogin = (now.getTime() - lastLogin) < TWENTY_FOUR_HOURS;
            const isRecentLoc = (now.getTime() - lastLoc) < FOUR_HOURS;

            return isRecentLogin || isRecentLoc;
        }).length;
    }, [employees]);

    const mrr = useMemo(() => {
        return state.serviceAgreements?.reduce((sum, a) => {
            return sum + (a.billingCycle === 'Monthly' ? a.price : a.price / 12);
        }, 0) || 0;
    }, [state.serviceAgreements]);

    const totalReceivables = useMemo(() => {
        return filteredJobs
            .filter(j => j.invoice?.status !== 'Paid')
            .reduce((sum, j) => sum + (j.invoice?.totalAmount || j.invoice?.amount || 0), 0);
    }, [filteredJobs]);
    
    // Pending Orders Calculation
    const pendingOrders = useMemo(() => {
        const internalPending = state.partOrders.filter(o => o.status === 'Pending Approval').length;
        const externalPending = (state.shopOrders || []).filter(o => o.status === 'Pending').length;
        return internalPending + externalPending;
    }, [state.partOrders, state.shopOrders]);

    // Active Warranties Calculation
    const activeWarrantiesCount = useMemo(() => {
        let count = 0;
        const now = new Date();
        const addMonths = (d: Date, m: number) => {
            const r = new Date(d);
            r.setMonth(r.getMonth() + m);
            return r;
        };

        filteredJobs.forEach(job => {
            const inv = job.invoice as { warrantyDisclaimerAgreed?: boolean, workmanshipWarrantyMonths?: number, partsWarrantyMonths?: number } | undefined;
            if (!inv || !inv.warrantyDisclaimerAgreed) return;
            const wm = inv.workmanshipWarrantyMonths || 0;
            const pm = inv.partsWarrantyMonths || 0;
            if (!wm && !pm) return;

            const issued = new Date(job.appointmentTime);
            const wExpiry = wm > 0 ? addMonths(issued, wm) : null;
            const pExpiry = pm > 0 ? addMonths(issued, pm) : null;

            if ((wExpiry && wExpiry > now) || (pExpiry && pExpiry > now)) {
                count++;
            }
        });
        return count;
    }, [filteredJobs]);

    // Maintenance Due Calculation
    const maintenanceDueCount = useMemo(() => {
        let count = 0;
        const now = new Date();
        Object.values(state.customers).forEach(customer => {
            if(customer.equipment) {
                customer.equipment.forEach(asset => {
                    if(asset.warranty?.requiresMaintenance && asset.warranty.maintenanceIntervalMonths) {
                        let nextDate: Date;
                        if(asset.warranty.lastMaintenanceDate) {
                            nextDate = new Date(asset.warranty.lastMaintenanceDate);
                        } else if(asset.warranty.manufacturerStartDate) {
                            nextDate = new Date(asset.warranty.manufacturerStartDate);
                        } else {
                            return;
                        }
                        nextDate.setMonth(nextDate.getMonth() + asset.warranty.maintenanceIntervalMonths);
                        const diffTime = nextDate.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if(diffDays <= 45) count++;
                    }
                });
            }
        });
        return count;
    }, [state.customers]);

    const orgName = state.currentOrganization?.name || 'My Business';
    const openIncidents = (state.incidentReports || []).filter((i: { status: string }) => i.status !== 'Resolved');

    const pendingAppointments = useMemo(() => {
        return (state.appointments || [])
            .filter((a: Appointment) => a.status === 'Pending')
            .sort((a,b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime());
    }, [state.appointments]);

    const liveOps = useMemo(() => {
        const now = new Date();
        return filteredJobs.filter((job: Job) => {
            if (job.jobStatus === 'In Progress') return true;
            const apptTime = new Date(job.appointmentTime);
            const diffMs = apptTime.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            return Math.abs(diffHours) < 2;
        }).sort((a: Job, b: Job) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime());
    }, [filteredJobs]);

    const handleAcceptAppointment = async (appt: Appointment) => {
        if (!await globalConfirm(`Accept booking for ${appt.customerName}? This will create a job.`)) return;

        let customerId = appt.customerId || '';
        
        if (!customerId) {
            const existingCust = state.customers.find(c => 
                (appt.customerEmail && c.email === appt.customerEmail) || 
                c.phone === appt.customerPhone
            );
            if (existingCust) {
                customerId = existingCust.id;
                if (appt.marketingConsent && !existingCust.marketingConsent) {
                    await db.collection('customers').doc(customerId).update(cleanUndefinedFields({
                        marketingConsent: appt.marketingConsent
                    })).catch(e => console.error("Failed to update consent:", e));
                }
            }
        }

        if (!customerId) {
            customerId = `cust-${Date.now()}`;
            const names = appt.customerName.split(' ');
            await db.collection('customers').doc(customerId).set(cleanUndefinedFields({
                id: customerId,
                organizationId: appt.organizationId,
                name: appt.customerName,
                firstName: names[0],
                lastName: names.slice(1).join(' '),
                phone: appt.customerPhone,
                email: appt.customerEmail || '',
                address: appt.address,
                customerType: (() => {
                    const rawType = (appt as any).customerType;
                    if (rawType === 'Business / Commercial' || rawType === 'General Contractor' || rawType === 'Commercial') {
                        return 'Commercial';
                    }
                    if (rawType === 'Property Manager' || rawType === 'Property Management') {
                        return 'Property Management';
                    }
                    return 'Residential';
                })(),
                hvacSystem: { brand: 'Unknown', type: 'Unknown' },
                serviceHistory: [],
                createdAt: new Date().toISOString(),
                ...(appt.marketingConsent ? { marketingConsent: appt.marketingConsent } : {})
            }));
        }

        let finalAppointmentTime = appt.appointmentTime;
        let extraInstructions = '';
        
        if (appt.appointmentTime) {
            const parts = appt.appointmentTime.trim().split(/\s+/);
            if (parts.length >= 2) {
                const datePart = parts[0];
                const timePart = parts.slice(1).join(' ');
                const parsedDate = new Date(datePart);
                if (!isNaN(parsedDate.getTime())) {
                    finalAppointmentTime = parsedDate.toISOString();
                    extraInstructions = `Requested Arrival Window: ${timePart}`;
                }
            } else if (appt.appointmentTime.toUpperCase() === 'TBD') {
                finalAppointmentTime = new Date().toISOString();
                extraInstructions = 'Requested Arrival Window: TBD';
            }
        }

        const newJob: Job = {
            id: `job-${Date.now()}`,
            organizationId: appt.organizationId,
            customerName: appt.customerName,
            customerId: customerId,
            customerEmail: appt.customerEmail,
            customerPhone: appt.customerPhone,
            address: appt.address,
            tasks: appt.tasks,
            jobStatus: 'Scheduled',
            appointmentTime: finalAppointmentTime,
            specialInstructions: [extraInstructions, appt.specialInstructions].filter(Boolean).join(' | '),
            source: appt.source || 'WebWidget',
            jobEvents: [],
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('jobs').doc(newJob.id).set(cleanUndefinedFields(newJob));
            dispatch({ type: 'ADD_JOB', payload: newJob });
            
            await db.collection('appointments').doc(appt.id).delete();
            dispatch({ type: 'DELETE_APPOINTMENT', payload: appt.id });

            showToast.success("Appointment accepted — job created!");
        } catch (e) {
            console.error(e);
            showToast.error("Failed to convert appointment.");
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        if (!await globalConfirm("Decline and delete this request?")) return;
        try {
            await db.collection('appointments').doc(id).delete();
            dispatch({ type: 'DELETE_APPOINTMENT', payload: id });
        } catch (e) {
            console.error(e);
        }
    };

    const alertsCount = useMemo(() => {
        return state.notifications.filter((n: { type?: string; userId?: string; read?: boolean }) => {
            if (n.type !== 'system_alert' || n.read) return false;
            return n.userId === currentUser?.id || 
                   n.userId === currentUser?.email ||
                   n.userId === 'all' ||
                   (currentUser?.role === 'master_admin' && (n.userId === 'rodzelem@gmail.com' || n.userId === 'ryanvavrecan@gmail.com')) ||
                   (n.userId === 'all_admins' && (currentUser?.role === 'admin' || currentUser?.role === 'master_admin' || currentUser?.role === 'both'));
        }).length;
    }, [state.notifications, currentUser]);

    return (
        <div className="flex flex-col gap-6">
            <header className="order-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
                <div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {(() => { const h = new Date().getHours(); return h < 12 ? t('Good morning') : h < 17 ? t('Good afternoon') : t('Good evening'); })()}, {currentUser?.firstName}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-0.5">{t('Operations hub for')} {orgName}</p>
                </div>
                <div className="flex gap-3 items-center">
                    {/* Clock In / Clock Out Button */}
                    {!isPaymentsOnly && (
                        <div className="flex items-center gap-2">
                            {activeShift ? (
                                <button
                                    type="button"
                                    onClick={handleClockOut}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-rose-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                                >
                                    <Clock size={16} className="animate-pulse" />
                                    <span>Clock Out ({elapsedTime})</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleClockIn}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                                >
                                    <Clock size={16} />
                                    <span>Clock In</span>
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg font-semibold text-sm border border-emerald-200 dark:border-emerald-800">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {t('Live')}
                    </div>
                </div>
            </header>

            {/* Payment Onboarding Banner for payments_only users */}
            {isPaymentsOnly && !hasCompletedMerchantSetup && (
                <div data-tour="payment-setup-banner" className="order-1 mt-2">
                    <button
                        type="button"
                        onClick={() => window.location.href = '#/admin/settings?tab=integrations'}
                        className="w-full text-left relative overflow-hidden bg-gradient-to-r from-emerald-900 via-emerald-800 to-cyan-900 rounded-2xl p-6 cursor-pointer shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-0.5 transition-all duration-300 group border border-emerald-700/50"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500 pointer-events-none">
                            <CreditCard size={80} className="text-white" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="bg-amber-500 text-slate-900 text-xs font-black px-3 py-1 uppercase tracking-widest rounded-full animate-pulse">Action Required</span>
                                <h3 className="text-xl font-extrabold text-white">Complete Your Payment Setup</h3>
                            </div>
                            <p className="text-emerald-200 mt-2 mb-4 max-w-xl text-sm">
                                You&apos;re almost ready to accept payments! Complete the merchant onboarding to start processing credit cards, debit cards, and ACH transfers through your account.
                            </p>
                            <div className="inline-flex items-center text-white font-bold bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl transition-colors">
                                Set Up Payments Now <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </button>
                </div>
            )}

            <div className="order-2 lg:order-5">
                <LiveOperations liveOps={liveOps} hideLink={isPaymentsOnly} />
            </div>

            <div data-tour="dashboard-metrics" className="order-3 lg:order-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                <MetricCard title="Jobs Active" value={jobsInProgress} path={isPaymentsOnly ? undefined : "/admin/operations?tab=jobs"} icon={TimeLogIcon} color="bg-blue-500" />
                <MetricCard title="Team Online" value={activeTechnicians} path={isPaymentsOnly ? undefined : "/admin/workforce"} icon={UsersIcon} color="bg-purple-500" />
                <MetricCard title="Company Events" value={eventsCount} path={isPaymentsOnly ? undefined : "/admin/calendar"} icon={Calendar} color="bg-indigo-600" />
                
                {currentUser?.role !== 'supervisor' && (
                    <>
                        <MetricCard title="Alerts" value={alertsCount} path={isPaymentsOnly ? undefined : "/admin/dashboard/alerts"} icon={AlertTriangle} color="bg-rose-500" />
                        <MetricCard title="Maintenance Due" value={maintenanceDueCount} path={isPaymentsOnly ? undefined : "/admin/dashboard/maintenance"} icon={Wrench} color="bg-indigo-500" />
                        <MetricCard title="Pending Orders" value={pendingOrders} path={isPaymentsOnly ? undefined : "/admin/dashboard/orders"} icon={ShoppingCart} color="bg-cyan-500" />
                        <MetricCard title="Active Warranties" value={activeWarrantiesCount} path={isPaymentsOnly ? undefined : "/admin/dashboard/active-warranties"} icon={ShieldCheck} color="bg-emerald-600" />
                        <MetricCard title="Unpaid Inv" value={unpaidInvoices} path="/admin/financials" icon={FinancialIcon} color="bg-orange-500" />
                        <MetricCard title="Monthly Rev" value={`$${Math.round(mrr).toLocaleString()}`} path={isPaymentsOnly ? undefined : "/admin/customers?tab=memberships"} icon={FinancialIcon} color="bg-emerald-500" />
                        <MetricCard title="Receivables" value={`$${Math.round(totalReceivables).toLocaleString()}`} path="/admin/financials" icon={FinancialIcon} color="bg-yellow-500" />
                    </>
                )}
                
                <MetricCard title="Hazards" value={openIncidents.length} path={isPaymentsOnly ? undefined : "/admin/compliance?tab=incidents"} icon={AlertTriangle} color="bg-red-500" />
            </div>

            {currentUser?.role !== 'supervisor' && !isPaymentsOnly && (
                <div className="order-4 lg:order-3">
                    <PendingAppointments 
                        appointments={pendingAppointments} 
                        onAccept={handleAcceptAppointment} 
                        onDelete={handleDeleteAppointment} 
                    />
                </div>
            )}

            {!state.currentOrganization?.virtualWorkerEnabled && !isPaymentsOnly && (
                <div className="order-5 lg:order-4">
                    <button 
                        type="button"
                        onClick={() => window.location.href = '#/admin/ai-worker-upgrade'}
                        className="w-full text-left relative overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl p-6 cursor-pointer shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all duration-300 group mt-2 mb-4"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500 pointer-events-none">
                            <Bot size={80} className="text-white" />
                        </div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="bg-primary-500 text-white text-xs font-black px-3 py-1 uppercase tracking-widest rounded-full">New Add-On</span>
                                <h3 className="text-xl font-extrabold text-white">Unlock the Virtual AI Worker</h3>
                            </div>
                            <p className="text-indigo-200 mt-2 mb-4 max-w-xl text-sm">
                                Automate dispatching, invoice clients, and let techs talk to the CRM hands-free.
                            </p>
                            <div className="inline-flex items-center text-white font-bold bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl transition-colors">
                                View Pricing & Details <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </button>
                </div>
            )}

            {!isPaymentsOnly && (
                <div className="order-6 mt-2">
                    <button
                        type="button"
                        onClick={() => window.location.href = '#/admin/whiteboard'}
                        className="w-full text-left relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-violet-950 rounded-2xl p-6 cursor-pointer shadow-xl hover:shadow-violet-500/20 hover:-translate-y-0.5 transition-all duration-300 group border border-slate-700/50"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500 pointer-events-none">
                            <Presentation size={100} className="text-white" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-black px-3 py-1 uppercase tracking-widest rounded-full flex items-center gap-1">
                                    <Sparkles size={12} className="animate-spin" /> Interactive
                                </span>
                                <h3 className="text-xl font-extrabold text-white">Admins Collaboration Board</h3>
                            </div>
                            <p className="text-slate-300 mt-2 mb-4 max-w-xl text-sm leading-relaxed">
                                Share thoughts, tasks, photos, and drawings in real time. Work together on an infinite canvas designed for organization owners and supervisors.
                            </p>
                            
                            <div className="flex flex-wrap gap-4 mb-5 text-xs font-semibold text-slate-300">
                                <div className="bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-2 border border-white/5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span>{whiteboardStats.stickies} Sticky Notes</span>
                                </div>
                                <div className="bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-2 border border-white/5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>{whiteboardStats.tasks} Checklist Tasks</span>
                                </div>
                                <div className="bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-2 border border-white/5">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                    <span>{whiteboardStats.photos} Shared Photos</span>
                                </div>
                            </div>
                            
                            <div className="inline-flex items-center text-white font-bold bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl transition-colors border border-white/10">
                                Open Immersive Whiteboard <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </button>
                </div>
            )}

        </div>
    );
};

export default AdminDashboard;
