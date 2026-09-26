import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";

import React, { useMemo, useState } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import { useNavigate } from 'react-router-dom';
import type { MembershipPlan, ServiceAgreement } from 'types';
import { db } from 'lib/firebase';
import { Shield, CheckCircle, Users, DollarSign, Wrench, FileText, Plus, Ban, Trash2, Eye } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";
import { isRecurringMembership, calculateAgreementMRR, formatAgreementDate, getAgreementClassification } from '../../lib/membershipHelper';
import AgreementViewerModal from '../../components/modals/AgreementViewerModal';

const DEFAULT_PLANS: Omit<MembershipPlan, 'organizationId'>[] = [
    { id: 'plan-gold', name: 'Gold Plan', monthlyPrice: 29.00, annualPrice: 300.00, discountPercentage: 20, discountScope: 'Both', visitsPerYear: 2, color: 'yellow', benefits: ['Priority Scheduling', 'No Dispatch Fees', '20% Parts Discount'], pricePerAdditionalSystem: 15.00 },
    { id: 'plan-silver', name: 'Silver Plan', monthlyPrice: 19.00, annualPrice: 200.00, discountPercentage: 15, discountScope: 'Part', visitsPerYear: 1, color: 'gray', benefits: ['Priority Scheduling', '15% Parts Discount'], pricePerAdditionalSystem: 10.00 },
    { id: 'plan-bronze', name: 'Bronze Plan', monthlyPrice: 9.00, annualPrice: 100.00, discountPercentage: 10, discountScope: 'Part', visitsPerYear: 1, color: 'orange', benefits: ['10% Parts Discount'], pricePerAdditionalSystem: 5.00 }
];

const Memberships: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
    const [benefitsText, setBenefitsText] = useState('');
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
    const [isEditAgreementModalOpen, setIsEditAgreementModalOpen] = useState(false);
    const [editingAgreement, setEditingAgreement] = useState<ServiceAgreement | null>(null);
    const [viewingAgreement, setViewingAgreement] = useState<ServiceAgreement | null>(null);
    const [agreementFilter, setAgreementFilter] = useState<'all' | 'memberships' | 'contracts'>('all');
    const [enrollForm, setEnrollForm] = useState({
        customerId: '',
        planId: '',
        billingCycle: 'Annual' as 'Monthly'|'Annual',
        systemCount: 1,
        paymentMethod: 'Check / Separate Invoice'
    });

    const agreements = state.serviceAgreements;
    
    // Merge defaults with DB plans
    const plans = useMemo(() => {
        const orgId = state.currentOrganization?.id || '';
        const dbPlansMap = new Map(state.membershipPlans.map(p => [p.id, p]));
        const mergedDefaults = DEFAULT_PLANS.map(def => {
            const existing = dbPlansMap.get(def.id);
            // Ensure benefits array exists
            const base: any = existing || { ...def, organizationId: orgId };
            if (!base.benefits) base.benefits = def.benefits;
            if (!base.discountScope) base.discountScope = 'Both'; // Default for existing plans
            if (base.pricePerAdditionalSystem === undefined) base.pricePerAdditionalSystem = def.pricePerAdditionalSystem || 0; // Default
            if (base.addonFeeName === undefined) base.addonFeeName = '';
            if (base.addonFeeAmount === undefined) base.addonFeeAmount = 0;
            if (base.addonFeePercent === undefined) base.addonFeePercent = 0;
            return base as MembershipPlan;
        });
        return mergedDefaults;
    }, [state.membershipPlans, state.currentOrganization?.id]);

    const stats = useMemo(() => {
        const activeAgreements = agreements.filter(a => a.status === 'Active');
        const activeMemberships = activeAgreements.filter(isRecurringMembership);
        const active = activeMemberships.length;
        const totalAgreements = agreements.length;
        
        // MRR Logic: Strictly count active recurring membership plans (excludes commercial contractor agreements / MSAs)
        const monthlyRevenue = calculateAgreementMRR(activeAgreements);

        const dueForVisit = activeAgreements.filter(a => (a.visitsRemaining || 0) > 0).length;
        return { active, totalAgreements, monthlyRevenue, dueForVisit };
    }, [agreements]);

    const filteredAgreements = useMemo(() => {
        if (agreementFilter === 'memberships') {
            return agreements.filter(isRecurringMembership);
        }
        if (agreementFilter === 'contracts') {
            return agreements.filter(a => !isRecurringMembership(a));
        }
        return agreements;
    }, [agreements, agreementFilter]);

    const handleEditPlan = (plan: MembershipPlan) => {
        setEditingPlan({ ...plan });
        setBenefitsText(plan.benefits ? plan.benefits.join('\n') : '');
        setIsPlanModalOpen(true);
    };

    const handleSavePlan = async () => {
        if (!editingPlan) return;
        const updatedPlan = { 
            ...editingPlan, 
            organizationId: state.currentOrganization?.id || '',
            benefits: benefitsText.split('\n').filter(b => b.trim() !== '')
        };
        
        try {
            await db.collection('membershipPlans').doc(updatedPlan.id).set(cleanUndefinedFields(updatedPlan));
            dispatch({ type: 'UPDATE_MEMBERSHIP_PLAN', payload: updatedPlan });
            setIsPlanModalOpen(false);
        } catch (e) {
            console.error(e);
            showToast.warn("Error saving plan");
        }
    };

    const handleCancelAgreement = async (id: string) => {
        if (!await globalConfirm("Are you sure you want to cancel this agreement?")) return;
        try {
            await db.collection('serviceAgreements').doc(id).update(cleanUndefinedFields({
                status: 'Cancelled',
                endDate: new Date().toISOString()
            }));
            // Update handled by snapshot listener or manual refresh
        } catch (e) {
            showToast.warn("Failed to cancel agreement.");
        }
    };

    const handleDeleteAgreement = async (id: string) => {
        if (!await globalConfirm("Permanently delete this membership record?")) return;
        try {
            await db.collection('serviceAgreements').doc(id).delete();
            // Optimistic update
            dispatch({ type: 'SYNC_DATA', payload: { serviceAgreements: state.serviceAgreements.filter(a => a.id !== id) } });
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to delete agreement.");
        }
    };

    const handleEnrollSubmit = async () => {
        if (!enrollForm.customerId || !enrollForm.planId) return showToast.warn("Please select a customer and plan.");
        const customer = state.customers.find(c => c.id === enrollForm.customerId);
        const plan = plans.find(p => p.id === enrollForm.planId);
        if (!customer || !plan) return;

        const price = enrollForm.billingCycle === 'Monthly' ? plan.monthlyPrice : plan.annualPrice;
        const totalSysPrice = (enrollForm.systemCount - 1) * (plan.pricePerAdditionalSystem || 0);
        const finalizedPrice = enrollForm.billingCycle === 'Monthly' ? (price + totalSysPrice) : (price + (totalSysPrice * 12));

        const planFee = (plan.addonFeeAmount || 0) + (finalizedPrice * (plan.addonFeePercent || 0) / 100);
        const totalRecurrentPrice = finalizedPrice + planFee;

        const newId = 'm-' + Date.now();
        const agreement: ServiceAgreement = {
            id: newId,
            organizationId: state.currentOrganization?.id || '',
            customerId: customer.id,
            customerName: customer.name,
            planName: plan.name,
            price: totalRecurrentPrice,
            billingCycle: enrollForm.billingCycle,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + (enrollForm.billingCycle === 'Annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
            status: 'Active',
            visitsTotal: plan.visitsPerYear || 0,
            visitsRemaining: plan.visitsPerYear || 0,
            systemCount: enrollForm.systemCount,
        };

        try {
            await db.collection('serviceAgreements').doc(newId).set(cleanUndefinedFields(agreement));
            setIsEnrollModalOpen(false);
            setEnrollForm({
                customerId: '',
                planId: '',
                billingCycle: 'Annual',
                systemCount: 1,
                paymentMethod: 'Check / Separate Invoice'
            });
        } catch (e) {
            console.error(e);
            showToast.warn("Error enrolling customer manually.");
        }
    };

    const handleGeneratePMs = async () => {
        if (!await globalConfirm("Generate PM Work Orders for all active memberships due for a visit? This will route jobs to preferred technicians if configured.")) return;
        
        let generatedCount = 0;
        const activeAgreements = state.serviceAgreements.filter(a => a.status === 'Active' && a.visitsRemaining > 0);
        
        let totalPms = 0;
        for (const agreement of activeAgreements) {
            const customer = state.customers.find(c => c.id === agreement.customerId);
            if (!customer) continue;
            const targetLocations = (customer.customerType as string) === 'Property Management' && customer.serviceLocations && customer.serviceLocations.length > 0 
                ? customer.serviceLocations 
                : [{ id: 'default', address: customer.address, propertyName: 'Primary Location', name: 'Primary Location', preferredTechnicianId: null as string | null }];
            totalPms += targetLocations.length;
        }

        for (const agreement of activeAgreements) {
            const customer = state.customers.find(c => c.id === agreement.customerId);
            if (!customer) continue;

            // Determine target locations
            const targetLocations = (customer.customerType as string) === 'Property Management' && customer.serviceLocations && customer.serviceLocations.length > 0 
                ? customer.serviceLocations 
                : [{ id: 'default', address: customer.address, propertyName: 'Primary Location', name: 'Primary Location', preferredTechnicianId: null as string | null }];

            for (const loc of targetLocations) {
                const techId = (loc as any).preferredTechnicianId || null;
                const tech = techId ? state.users.find((u: any) => u.id === techId) : null;
                const techName = tech ? `${tech.firstName} ${tech.lastName}` : 'Unassigned (Queue)';

                const newJobId = `job-pm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const newJob = {
                    id: newJobId,
                    organizationId: state.currentOrganization?.id || '',
                    customerName: customer.name,
                    customerId: customer.id,
                    address: loc.address || customer.address,
                    locationId: loc.id !== 'default' ? loc.id : null,
                    locationName: loc.propertyName || loc.name,
                    tasks: ['Preventative Maintenance'],
                    jobStatus: 'Scheduled',
                    priority: 'Normal',
                    appointmentTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Schedule 1 week out
                    assignedTechnicianId: techId,
                    assignedTechnicianName: techName,
                    source: 'Auto-PM',
                    specialInstructions: `Auto-generated PM for ${agreement.planName} Membership.`,
                    jobEvents: [],
                    createdAt: new Date().toISOString()
                };

                try {
                    await db.collection('jobs').doc(newJobId).set(cleanUndefinedFields(newJob));
                    generatedCount++;
                } catch (e) {
                    console.error("Failed to generate PM:", e);
                }
            }

            // Decrement visit count
            try {
                const updatedVisits = Math.max(0, agreement.visitsRemaining - 1);
                await db.collection('serviceAgreements').doc(agreement.id).update(cleanUndefinedFields({ visitsRemaining: updatedVisits }));
            } catch (e) {
                console.error("Failed to update agreement visits:", e);
            }
        }
        
        if (generatedCount > 0) {
            showToast.success(`Successfully generated and routed ${generatedCount} PM Work Orders.`);
        } else {
            showToast.warn("No active agreements found that require visits.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Membership Operations</h2>
                <div className="flex gap-2">
                    <Button onClick={handleGeneratePMs} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                        <Wrench size={18} /> Generate PM Batch
                    </Button>
                    <Button onClick={() => setIsEnrollModalOpen(true)} className="flex items-center gap-2">
                        <Plus size={18} /> Manual Enrollment
                    </Button>
                </div>
            </div>
            

            {/* KPI Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="flex items-center gap-4 bg-green-50 dark:bg-green-900/20 border border-green-200">
                    <div className="p-3 bg-green-200 dark:bg-green-800 rounded-full text-green-700"><Users size={20}/></div>
                    <div>
                        <p className="text-xs font-bold text-green-700 uppercase">Active Members</p>
                        <p className="text-2xl font-bold dark:text-white">{stats.active}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200">
                    <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-full text-blue-700"><DollarSign size={20}/></div>
                    <div>
                        <p className="text-xs font-bold text-blue-700 uppercase">Monthly Revenue</p>
                        <p className="text-2xl font-bold dark:text-white">${stats.monthlyRevenue.toFixed(0)}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200">
                    <div className="p-3 bg-yellow-200 dark:bg-yellow-800 rounded-full text-yellow-700"><Wrench size={20}/></div>
                    <div>
                        <p className="text-xs font-bold text-yellow-700 uppercase">Tune-ups Due</p>
                        <p className="text-2xl font-bold dark:text-white">{stats.dueForVisit}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 border border-gray-200">
                    <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700"><FileText size={20}/></div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">Total Agreements</p>
                        <p className="text-2xl font-bold dark:text-white">{stats.totalAgreements}</p>
                    </div>
                </Card>
            </div>

            {/* Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => {
                    return (
                    <div key={plan.id} className={`rounded-xl border-t-8 shadow-lg p-6 bg-white dark:bg-gray-800 flex flex-col ${plan.color === 'yellow' ? 'border-yellow-400' : plan.color === 'gray' ? 'border-gray-400' : plan.color === 'orange' ? 'border-orange-400' : 'border-blue-400'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                            <Shield className="w-6 h-6" style={{ color: plan.color }} />
                        </div>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">${plan.monthlyPrice}<span className="text-sm font-normal text-gray-500">/mo</span></div>
                        <p className="text-sm text-gray-500 mb-4">${plan.annualPrice}/yr</p>
                        
                        <ul className="space-y-2 mb-6 flex-1">
                            <li className="flex items-center gap-2 text-sm"><CheckCircle size={14} className="text-green-500"/> {plan.visitsPerYear} Visits / Year</li>
                            <li className="flex items-center gap-2 text-sm"><CheckCircle size={14} className="text-green-500"/> {plan.discountPercentage}% Discount ({plan.discountScope || 'Both'})</li>
                            <li className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Plus size={14}/> +${plan.pricePerAdditionalSystem}/mo per extra system</li>
                            {((plan.addonFeeAmount || 0) > 0 || (plan.addonFeePercent || 0) > 0) && (
                                <li className="flex items-center gap-2 text-sm font-semibold text-indigo-500">
                                    <Plus size={14}/> + {plan.addonFeeName || 'Signup Fee'}: {
                                        (plan.addonFeeAmount || 0) > 0 && (plan.addonFeePercent || 0) > 0
                                            ? `$${plan.addonFeeAmount.toFixed(2)} + ${plan.addonFeePercent}%`
                                            : (plan.addonFeeAmount || 0) > 0
                                                ? `$${plan.addonFeeAmount.toFixed(2)}`
                                                : `${plan.addonFeePercent}%`
                                    }
                                </li>
                            )}
                            {plan.benefits?.map((b, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm"><CheckCircle size={14} className="text-green-500"/> {b}</li>
                            ))}
                        </ul>
                        
                        <Button onClick={() => handleEditPlan(plan)} variant="secondary" className="w-full mt-auto">Edit Plan</Button>
                    </div>
                    );
                })}
            </div>

            {/* Agreements Table */}
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                        <h3 className="text-lg font-bold dark:text-white">Service Agreements &amp; Memberships</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Click any agreement to view full contract details, rate schedules, and executed legal documents.
                        </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setAgreementFilter('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                agreementFilter === 'all'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                            }`}
                        >
                            All ({agreements.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setAgreementFilter('memberships')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                agreementFilter === 'memberships'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                            }`}
                        >
                            Memberships ({agreements.filter(isRecurringMembership).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setAgreementFilter('contracts')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                agreementFilter === 'contracts'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                            }`}
                        >
                            Commercial Contracts ({agreements.filter(a => !isRecurringMembership(a)).length})
                        </button>
                    </div>
                </div>

                {/* Mobile Cards View (App / Mobile View Only) */}
                <div className="md:hidden space-y-3.5 mb-6">
                    {filteredAgreements.map(a => {
                        const classMeta = getAgreementClassification(a);
                        return (
                            <div 
                                key={`agreement-card-${a.id}`}
                                onClick={() => setViewingAgreement(a)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3 cursor-pointer"
                            >
                                {/* Card Header: Customer, Plan, Type, Status */}
                                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                            {a.customerName}
                                        </h4>
                                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{a.planName}</span>
                                            {a.contractNumber && (
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-bold">
                                                    #{a.contractNumber}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${classMeta.badgeColor}`}>
                                            {classMeta.label}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800'}`}>
                                            {a.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Scope & Renewal / Term */}
                                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Scope</span>
                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                            {a.siteCount ? `${a.siteCount} Sites` : `${a.systemCount || 1} System`}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Renewal / Term</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                            {formatAgreementDate(a)}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions Bar */}
                                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                                        Tap to view details
                                    </span>
                                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewingAgreement(a);
                                            }} 
                                            className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-900/50" 
                                            title="View Agreement & Document"
                                        >
                                            <Eye size={14}/>
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingAgreement({...a});
                                                setIsEditAgreementModalOpen(true);
                                            }} 
                                            className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-900/50" 
                                            title="Edit Agreement"
                                        >
                                            <Wrench size={14}/>
                                        </button>
                                        {a.status === 'Active' && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancelAgreement(a.id);
                                                }} 
                                                className="p-1.5 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300 rounded-lg border border-orange-200 dark:border-orange-900/50" 
                                                title="Cancel Membership"
                                            >
                                                <Ban size={14}/>
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteAgreement(a.id);
                                            }} 
                                            className="p-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50" 
                                            title="Delete Record"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredAgreements.length === 0 && (
                        <div className="p-8 text-center text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                            No agreements found matching your filter.
                        </div>
                    )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                <Table headers={['Customer', 'Type', 'Plan / Agreement', 'Scope', 'Renewal / Term', 'Status', 'Action']}>
                    {filteredAgreements.map(a => {
                        const classMeta = getAgreementClassification(a);
                        return (
                            <tr 
                                key={a.id}
                                onClick={() => setViewingAgreement(a)}
                                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                            >
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                    {a.customerName}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${classMeta.badgeColor}`}>
                                        {classMeta.label}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{a.planName}</span>
                                        {a.contractNumber && (
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-bold">
                                                #{a.contractNumber}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-mono text-center">
                                    {a.siteCount ? `${a.siteCount} Sites` : `${a.systemCount || 1} System`}
                                </td>
                                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                    {formatAgreementDate(a)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${a.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800'}`}>{a.status}</span>
                                </td>
                                <td className="px-6 py-4 flex items-center gap-2">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingAgreement(a);
                                        }} 
                                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors" 
                                        title="View Agreement & Document"
                                    >
                                        <Eye size={16}/>
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAgreement({...a});
                                            setIsEditAgreementModalOpen(true);
                                        }} 
                                        className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors" 
                                        title="Edit Agreement"
                                    >
                                        <Wrench size={16}/>
                                    </button>
                                    {a.status === 'Active' && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCancelAgreement(a.id);
                                            }} 
                                            className="text-orange-500 hover:text-orange-700 p-1 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded transition-colors" 
                                            title="Cancel Membership"
                                        >
                                            <Ban size={16}/>
                                        </button>
                                    )}
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAgreement(a.id);
                                        }} 
                                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors" 
                                        title="Delete Record"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </Table>
                </div>
            </Card>

            <Modal isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} title={`Edit ${editingPlan?.name}`}>
                {editingPlan && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Monthly Price ($)" type="number" value={editingPlan.monthlyPrice} onChange={e => setEditingPlan({...editingPlan, monthlyPrice: parseFloat(e.target.value)})} />
                            <Input label="Annual Price ($)" type="number" value={editingPlan.annualPrice} onChange={e => setEditingPlan({...editingPlan, annualPrice: parseFloat(e.target.value)})} />
                        </div>
                        
                        <Input 
                            label="Price Per Additional System ($/mo)" 
                            type="number" 
                            value={editingPlan.pricePerAdditionalSystem || 0} 
                            onChange={e => setEditingPlan({...editingPlan, pricePerAdditionalSystem: parseFloat(e.target.value)})} 
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Visits/Year" type="number" value={editingPlan.visitsPerYear} onChange={e => setEditingPlan({...editingPlan, visitsPerYear: parseInt(e.target.value)})} />
                            <Input label="Discount %" type="number" value={editingPlan.discountPercentage} onChange={e => setEditingPlan({...editingPlan, discountPercentage: parseInt(e.target.value)})} />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <Select 
                                label="Discount Applies To" 
                                value={editingPlan.discountScope || 'Both'} 
                                onChange={e => setEditingPlan({...editingPlan, discountScope: e.target.value as any})}
                            >
                                <option value="Labor">Labor Only</option>
                                <option value="Part">Parts Only</option>
                                <option value="Both">Parts & Labor</option>
                            </Select>
                        </div>
                        


                        <div className="p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50/50 dark:bg-gray-800/30 space-y-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan Add-on Fee (Sign-up, Processing, etc.)</h4>
                            <Input 
                                label="Fee Label / Name" 
                                placeholder="e.g. Signup Fee, Account Setup Fee"
                                value={editingPlan.addonFeeName || ''} 
                                onChange={e => setEditingPlan({...editingPlan, addonFeeName: e.target.value})} 
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Flat Amount ($)" 
                                    type="number" 
                                    value={editingPlan.addonFeeAmount || 0} 
                                    onChange={e => setEditingPlan({...editingPlan, addonFeeAmount: parseFloat(e.target.value) || 0})} 
                                />
                                <Input 
                                    label="Percentage (%)" 
                                    type="number" 
                                    value={editingPlan.addonFeePercent || 0} 
                                    onChange={e => setEditingPlan({...editingPlan, addonFeePercent: parseFloat(e.target.value) || 0})} 
                                />
                            </div>
                        </div>

                        <Textarea label="Benefits (One per line)" rows={5} value={benefitsText} onChange={e => setBenefitsText(e.target.value)} />
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={() => setIsPlanModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSavePlan}>Save Changes</Button>
                        </div>
                    </div>
                )}
            </Modal>
            
            <Modal isOpen={isEnrollModalOpen} onClose={() => setIsEnrollModalOpen(false)} title="Manual Enrollment">
                <div className="space-y-4">
                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg border border-yellow-200 text-sm">
                        <strong>Note:</strong> Manual enrollments <strong>bypass</strong> the automated initial invoice and credit card charge process. Use this when a customer paid by check, cash, or you already manually added their membership cost onto an existing repair invoice.
                    </div>

                    <Select
                        label="Customer"
                        value={enrollForm.customerId}
                        onChange={(e) => setEnrollForm({ ...enrollForm, customerId: e.target.value })}
                    >
                        <option value="">Select a Customer</option>
                        {state.customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name} {c.address ? `- ${c.address}` : ''}</option>
                        ))}
                    </Select>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Membership Plan"
                            value={enrollForm.planId}
                            onChange={(e) => setEnrollForm({ ...enrollForm, planId: e.target.value })}
                        >
                            <option value="">Select a Plan</option>
                            {plans.map(p => (
                                <option key={p.id} value={p.id}>{p.name} - ${p.monthlyPrice}/mo or ${p.annualPrice}/yr</option>
                            ))}
                        </Select>

                        <Select
                            label="Billing Cycle"
                            value={enrollForm.billingCycle}
                            onChange={(e) => setEnrollForm({ ...enrollForm, billingCycle: e.target.value as any })}
                        >
                            <option value="Annual">Annual (Prepaid / 1 Year Expish)</option>
                            <option value="Monthly">Monthly (1 Month Expish)</option>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            type="number"
                            label="Number of Systems"
                            value={enrollForm.systemCount}
                            onChange={(e) => setEnrollForm({ ...enrollForm, systemCount: parseInt(e.target.value) || 1 })}
                            min="1"
                        />
                        
                        <Select
                            label="Payment Method"
                            value={enrollForm.paymentMethod}
                            onChange={(e) => setEnrollForm({ ...enrollForm, paymentMethod: e.target.value })}
                        >
                            <option value="Check / Separate Invoice">Paid by Check / Separate Invoice</option>
                            <option value="Cash">Paid by Cash</option>
                            <option value="Complimentary">Complimentary / Free Trial</option>
                        </Select>
                    </div>

                    {state.currentOrganization && (state.currentOrganization.cardProcessingFeeEnabled || state.currentOrganization.achProcessingFeeEnabled) && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-200 text-xs rounded-lg border border-indigo-100 dark:border-indigo-900 space-y-1">
                            <div className="font-bold">💳 Active Payment Processor Fees Notice</div>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {state.currentOrganization.cardProcessingFeeEnabled && (
                                    <li>Card Surcharge: {state.currentOrganization.cardProcessingFeePercent}% + ${state.currentOrganization.cardProcessingFeeFlat.toFixed(2)}</li>
                                )}
                                {state.currentOrganization.achProcessingFeeEnabled && (
                                    <li>ACH Surcharge: {state.currentOrganization.achProcessingFeePercent}% + ${state.currentOrganization.achProcessingFeeFlat.toFixed(2)}</li>
                                )}
                            </ul>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setIsEnrollModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleEnrollSubmit} className="bg-green-600 hover:bg-green-700 text-white">Enroll & Activate</Button>
                    </div>
                </div>
            </Modal>

            {/* Edit Agreement Modal */}
            <Modal isOpen={isEditAgreementModalOpen} onClose={() => setIsEditAgreementModalOpen(false)} title="Edit Service Agreement">
                {editingAgreement && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Status"
                                value={editingAgreement.status}
                                onChange={(e) => setEditingAgreement({ ...editingAgreement, status: e.target.value as 'Active' | 'Cancelled' | 'Expired' })}
                            >
                                <option value="Active">Active</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Expired">Expired</option>
                            </Select>

                            <Select
                                label="Billing Cycle"
                                value={editingAgreement.billingCycle}
                                onChange={(e) => setEditingAgreement({ ...editingAgreement, billingCycle: e.target.value as 'Annual' | 'Monthly' })}
                            >
                                <option value="Annual">Annual</option>
                                <option value="Monthly">Monthly</option>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Start Date"
                                type="date"
                                value={editingAgreement.startDate ? new Date(editingAgreement.startDate).toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                    const newDate = new Date(e.target.value);
                                    if (!isNaN(newDate.getTime())) {
                                        setEditingAgreement({ ...editingAgreement, startDate: newDate.toISOString() });
                                    }
                                }}
                            />
                            
                            <Input
                                label="Renewal Date (End Date)"
                                type="date"
                                value={editingAgreement.endDate ? new Date(editingAgreement.endDate).toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                    const newDate = new Date(e.target.value);
                                    if (!isNaN(newDate.getTime())) {
                                        setEditingAgreement({ ...editingAgreement, endDate: newDate.toISOString() });
                                    }
                                }}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={() => setIsEditAgreementModalOpen(false)}>Cancel</Button>
                            <Button onClick={async () => {
                                try {
                                    await db.collection('serviceAgreements').doc(editingAgreement.id).update(cleanUndefinedFields(editingAgreement));
                                    setIsEditAgreementModalOpen(false);
                                    showToast.success("Agreement updated.");
                                } catch (e) {
                                    showToast.error("Failed to update agreement.");
                                }
                            }} className="bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* View Full Agreement & Document Modal */}
            <AgreementViewerModal
                isOpen={!!viewingAgreement}
                onClose={() => setViewingAgreement(null)}
                agreement={viewingAgreement}
                organization={state.currentOrganization}
            />
        </div>
    );
};

export default Memberships;
