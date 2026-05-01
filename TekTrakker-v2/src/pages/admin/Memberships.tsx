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
import { Shield, CheckCircle, Users, DollarSign, Wrench, FileText, Plus, Ban, Trash2 } from 'lucide-react';
import { globalConfirm } from "lib/globalConfirm";

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
            return base as MembershipPlan;
        });
        return mergedDefaults;
    }, [state.membershipPlans, state.currentOrganization?.id]);

    const stats = useMemo(() => {
        const activeAgreements = agreements.filter(a => a.status === 'Active');
        const active = activeAgreements.length;
        const totalAgreements = agreements.length;
        
        // Corrected MRR Logic: Only count ACTIVE plans
        const monthlyRevenue = activeAgreements.reduce((sum, a) => {
            // Price normalization: If annual, divide by 12
            const monthlyVal = a.billingCycle === 'Monthly' ? a.price : (a.price / 12);
            return sum + monthlyVal;
        }, 0);

        const dueForVisit = activeAgreements.filter(a => a.visitsRemaining > 0).length;
        return { active, totalAgreements, monthlyRevenue, dueForVisit };
    }, [agreements]);

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
            await db.collection('membershipPlans').doc(updatedPlan.id).set(updatedPlan);
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
            await db.collection('serviceAgreements').doc(id).update({
                status: 'Cancelled',
                endDate: new Date().toISOString()
            });
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

        const newId = 'm-' + Date.now();
        const agreement: ServiceAgreement = {
            id: newId,
            organizationId: state.currentOrganization?.id || '',
            customerId: customer.id,
            customerName: customer.name,
            planName: plan.name,
            price: finalizedPrice,
            billingCycle: enrollForm.billingCycle,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + (enrollForm.billingCycle === 'Annual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
            status: 'Active',
            visitsTotal: plan.visitsPerYear || 0,
            visitsRemaining: plan.visitsPerYear || 0,
            systemCount: enrollForm.systemCount,
        };

        try {
            await db.collection('serviceAgreements').doc(newId).set(agreement);
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Membership Operations</h2>
                <Button onClick={() => setIsEnrollModalOpen(true)} className="flex items-center gap-2">
                    <Plus size={18} /> Manual Enrollment
                </Button>
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
                <h3 className="text-lg font-bold mb-4 dark:text-white">Membership Agreements</h3>
                <Table headers={['Customer', 'Plan', 'Systems', 'Renewal Date', 'Status', 'Action']}>
                    {agreements.map(a => (
                        <tr key={a.id}>
                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{a.customerName}</td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{a.planName}</td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-mono text-center">{a.systemCount || 1}</td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{new Date(a.endDate).toLocaleDateString()}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${a.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{a.status}</span>
                            </td>
                            <td className="px-6 py-4 flex items-center gap-2">
                                <button onClick={() => {
                                    setEditingAgreement({...a});
                                    setIsEditAgreementModalOpen(true);
                                }} className="text-blue-500 hover:text-blue-700" title="Edit Agreement">
                                    <Wrench size={16}/>
                                </button>
                                {a.status === 'Active' && (
                                    <button onClick={() => handleCancelAgreement(a.id)} className="text-orange-500 hover:text-orange-700" title="Cancel Membership">
                                        <Ban size={16}/>
                                    </button>
                                )}
                                <button onClick={() => handleDeleteAgreement(a.id)} className="text-red-500 hover:text-red-700" title="Delete Record">
                                    <Trash2 size={16}/>
                                </button>
                            </td>
                        </tr>
                    ))}
                </Table>
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
                        
                        {/* PayPal Plan ID Input */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                            <Input 
                                label="PayPal Plan ID (For Subscriptions)" 
                                value={editingPlan.paypalPlanId || ''} 
                                onChange={e => setEditingPlan({...editingPlan, paypalPlanId: e.target.value})} 
                                placeholder="P-1234567890..." 
                            />
                            <p className="text-[10px] text-gray-500 mt-1">
                                Create a subscription product in your PayPal dashboard and paste the Plan ID here to enable automatic recurring billing.
                            </p>
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
                                    await db.collection('serviceAgreements').doc(editingAgreement.id).update(editingAgreement);
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
        </div>
    );
};

export default Memberships;
