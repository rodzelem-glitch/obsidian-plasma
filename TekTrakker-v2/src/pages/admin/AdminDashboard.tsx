
import React, { useMemo, useState } from 'react';
import { FinancialIcon, UsersIcon, TimeLogIcon, AlertTriangle } from '../../constants/constants';
import { useAppContext } from '../../context/AppContext';
import type { Job, User, Appointment } from '../../types/types';
import { db } from '../../lib/firebase';
import MetricCard from './dashboard/components/MetricCard';
import PendingAppointments from './dashboard/components/PendingAppointments';
import LiveOperations from './dashboard/components/LiveOperations';
import { ShoppingCart, Bot, ArrowRight, Wrench, Network, Megaphone, ShieldCheck } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import showToast from "lib/toast";

const AdminDashboard: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const currentUser = state.currentUser;
    
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
            const inv = job.invoice as any;
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
                        let nextDate = new Date();
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
    const openIncidents = (state.incidentReports || []).filter((i: any) => i.status !== 'Resolved');

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
            }
        }

        if (!customerId) {
            customerId = `cust-${Date.now()}`;
            const names = appt.customerName.split(' ');
            await db.collection('customers').doc(customerId).set({
                id: customerId,
                organizationId: appt.organizationId,
                name: appt.customerName,
                firstName: names[0],
                lastName: names.slice(1).join(' '),
                phone: appt.customerPhone,
                email: appt.customerEmail || '',
                address: appt.address,
                customerType: 'Residential',
                hvacSystem: { brand: 'Unknown', type: 'Unknown' },
                serviceHistory: [],
                createdAt: new Date().toISOString()
            });
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
            appointmentTime: appt.appointmentTime,
            specialInstructions: appt.specialInstructions || '',
            source: appt.source || 'WebWidget',
            invoice: {
                id: `INV-${Date.now()}`,
                status: 'Unpaid',
                items: [],
                subtotal: 0,
                taxRate: 0.0825,
                taxAmount: 0,
                totalAmount: 0,
                amount: 0
            },
            jobEvents: [],
            createdAt: new Date().toISOString()
        };

        try {
            await db.collection('jobs').doc(newJob.id).set(newJob);
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

    return (
        <div className="flex flex-col gap-6">
            <header className="order-1 flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
                <div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })()}, {currentUser?.firstName}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-0.5">Operations hub for {orgName}</p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg font-semibold text-sm border border-emerald-200 dark:border-emerald-800">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live
                    </div>
                </div>
            </header>

            <div className="order-2 lg:order-5">
                <LiveOperations liveOps={liveOps} />
            </div>

            <div className="order-3 lg:order-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                <MetricCard title="Jobs Active" value={jobsInProgress} path="/admin/operations?tab=jobs" icon={TimeLogIcon} color="bg-blue-500" />
                <MetricCard title="Team Online" value={activeTechnicians} path="/admin/workforce" icon={UsersIcon} color="bg-purple-500" />
                
                {currentUser?.role !== 'supervisor' && (
                    <>
                        <MetricCard title="Maintenance Due" value={maintenanceDueCount} path="/admin/dashboard/maintenance" icon={Wrench} color="bg-indigo-500" />
                        <MetricCard title="Pending Orders" value={pendingOrders} path="/admin/dashboard/orders" icon={ShoppingCart} color="bg-cyan-500" />
                        <MetricCard title="Active Warranties" value={activeWarrantiesCount} path="/admin/dashboard/active-warranties" icon={ShieldCheck} color="bg-emerald-600" />
                        <MetricCard title="Unpaid Inv" value={unpaidInvoices} path="/admin/financials" icon={FinancialIcon} color="bg-orange-500" />
                        <MetricCard title="Monthly Rev" value={`$${Math.round(mrr).toLocaleString()}`} path="/admin/customers?tab=memberships" icon={FinancialIcon} color="bg-emerald-500" />
                        <MetricCard title="Receivables" value={`$${Math.round(totalReceivables).toLocaleString()}`} path="/admin/financials" icon={FinancialIcon} color="bg-yellow-500" />
                    </>
                )}
                
                <MetricCard title="Hazards" value={openIncidents.length} path="/admin/compliance?tab=incidents" icon={AlertTriangle} color="bg-red-500" />
            </div>

            {currentUser?.role !== 'supervisor' && (
                <div className="order-4 lg:order-3">
                    <PendingAppointments 
                        appointments={pendingAppointments} 
                        onAccept={handleAcceptAppointment} 
                        onDelete={handleDeleteAppointment} 
                    />
                </div>
            )}

            {!state.currentOrganization?.virtualWorkerEnabled && (
                <div className="order-5 lg:order-4">
                    <div 
                        onClick={() => window.location.href = '#/admin/ai-worker-upgrade'}
                        className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl p-6 cursor-pointer shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all duration-300 group mt-2 mb-4"
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
                    </div>
                </div>
            )}



        </div>
    );
};

export default AdminDashboard;
