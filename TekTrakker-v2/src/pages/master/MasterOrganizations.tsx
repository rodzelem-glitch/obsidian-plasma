
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Organization } from '../../types/types';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Card from '../../components/ui/Card';
import Toggle from '../../components/ui/Toggle';
import { Plus, Eye, Trash2, Edit, LogIn } from 'lucide-react';
import { toast } from 'react-toastify';
import { globalConfirm } from "lib/globalConfirm";

const MasterOrganizations: React.FC = () => {
    const { impersonateOrganization, state } = useAppContext();
    const { currentUser, isMasterAdmin } = state;
    const navigate = useNavigate();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingOrg, setCreatingOrg] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [orgForm, setOrgForm] = useState({
        name: '',
        email: '',
        phone: '',
        plan: 'starter',
        subscriptionStatus: 'active',
        address: '',
        city: '',
        state: '',
        zip: '',
        adminPassword: ''
    });
    const [showOrgAdminPassword, setShowOrgAdminPassword] = useState(false);

    useEffect(() => {
        if (!isMasterAdmin) {
            setLoading(false);
            return;
        }
        const unsubscribe = onSnapshot(collection(db, 'organizations'), (snapshot) => {
            const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
            setOrganizations(orgs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isMasterAdmin]);

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // 1. Create Organization
            const orgRef = await addDoc(collection(db, 'organizations'), {
                name: orgForm.name,
                email: orgForm.email,
                phone: orgForm.phone,
                plan: orgForm.plan,
                subscriptionStatus: orgForm.subscriptionStatus,
                isVerified: false,
                address: {
                    street: orgForm.address || '',
                    city: orgForm.city || '',
                    state: orgForm.state || '',
                    zip: orgForm.zip || '',
                },
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.id || 'master_admin',
            });

            // 2. Create subcollection user (for organization records)
            await addDoc(collection(db, `organizations/${orgRef.id}/users`), {
                email: orgForm.email.toLowerCase(),
                role: 'admin',
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.id || 'master_admin',
            });

            // 3. Create root user document (Acts as an INVITE for registration)
            // This allows the admin to register via the public site and be automatically linked.
            await setDoc(doc(db, 'users', orgForm.email.toLowerCase()), {
                email: orgForm.email.toLowerCase(),
                organizationId: orgRef.id,
                role: 'admin',
                status: 'active',
                firstName: orgForm.name,
                lastName: '(Admin)',
                createdAt: new Date().toISOString(),
                preferences: { theme: 'dark' },
                hireDate: new Date().toISOString(),
                payRate: 0,
                ptoAccrued: 0
            });

            // 4. Create proper Auth record via Server-Side Admin SDK
            const createAuth = httpsCallable(getFunctions(), 'createUserAuth');
            await createAuth({
                email: orgForm.email.toLowerCase(),
                password: orgForm.adminPassword,
                displayName: `${orgForm.name} Admin`,
                role: 'admin',
                organizationId: orgRef.id
            });

            toast.success('Organization and Admin account created successfully! The Organization can now log in.');
            setCreatingOrg(false);
            setOrgForm({
                name: '', email: '', phone: '', plan: 'starter', subscriptionStatus: 'active',
                address: '', city: '', state: '', zip: '', adminPassword: ''
            });
        } catch (error: any) {
            console.error("Create Org Error:", error);
            toast.error(`Failed to create organization: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImpersonate = async (org: Organization) => {
        if (await globalConfirm(`Are you sure you want to log in as an admin for "${org.name}"?`)) {
            try {
                await impersonateOrganization(org);
                navigate('/admin/dashboard');
            } catch (error) {
                toast.error("Failed to log in as organization admin.");
            }
        }
    };

    const handleEditOrg = (org: Organization) => {
        setEditingOrg(org);
        setOrgForm({
            name: org.name,
            email: org.email || '',
            phone: org.phone || '',
            plan: (org.plan || 'starter') as string,
            subscriptionStatus: (org.subscriptionStatus || 'active') as string,
            address: org.address?.street || '',
            city: org.address?.city || '',
            state: org.address?.state || '',
            zip: org.address?.zip || '',
            adminPassword: '',
        });
    };

    const handleUpdateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrg) return;
        setIsSubmitting(true);
        try {
            const orgRef = doc(db, 'organizations', editingOrg.id);
            await updateDoc(orgRef, {
                name: orgForm.name,
                email: orgForm.email,
                phone: orgForm.phone,
                plan: orgForm.plan,
                subscriptionStatus: orgForm.subscriptionStatus,
                address: {
                    street: orgForm.address,
                    city: orgForm.city,
                    state: orgForm.state,
                    zip: orgForm.zip,
                },
            });
            toast.success('Organization updated successfully!');
            setEditingOrg(null);
        } catch (error: any) {
            toast.error(`Failed to update organization: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteOrg = async (orgId: string) => {
        if (await globalConfirm("Are you sure you want to delete this organization? This action cannot be undone.")) {
            try {
                await deleteDoc(doc(db, 'organizations', orgId));
                toast.success('Organization deleted successfully!');
            } catch (error: any) {
                toast.error(`Failed to delete organization: ${error.message}`);
            }
        }
    };

    const handleToggleVerified = async (org: Organization) => {
        const orgRef = doc(db, 'organizations', org.id);
        try {
            await updateDoc(orgRef, { isVerified: !org.isVerified });
            toast.success(`Verification status updated for ${org.name}`);
        } catch (error) {
            toast.error("Failed to update verification status.");
        }
    };

    const handleToggleLeadingPro = async (org: Organization) => {
        const orgRef = doc(db, 'organizations', org.id);
        try {
            await updateDoc(orgRef, { isLeadingPro: !org.isLeadingPro });
            toast.success(`Leading Pro status updated for ${org.name}`);
        } catch (error) {
            toast.error("Failed to update Leading Pro status.");
        }
    };

    const handleToggleVirtualWorker = async (org: Organization) => {
        const orgRef = doc(db, 'organizations', org.id);
        try {
            await updateDoc(orgRef, { virtualWorkerEnabled: !org.virtualWorkerEnabled });
            toast.success(`Virtual Worker status updated for ${org.name}`);
        } catch (error) {
            toast.error("Failed to update Virtual Worker status.");
        }
    };

    const headers = ['Name/Email', 'Plan Info', 'Status', 'Retention/Churn Data', 'Verified', 'Actions'];

    if (loading) return <div>Loading...</div>;
    if (!isMasterAdmin) return <div className="p-6">You are not authorized to view this page.</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Organizations</h1>
                <Button onClick={() => setCreatingOrg(true)}>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Organization
                </Button>
            </div>

            <Card className="overflow-x-auto">
                <Table headers={headers}>
                    {organizations.map(org => (
                        <tr key={org.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{org.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{org.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900 dark:text-white uppercase">{org.plan}</div>
                                {org.customDiscountPct > 0 && <span className="text-xs text-emerald-500 font-bold">{org.customDiscountPct}% Off Applied</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    org.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    org.subscriptionStatus === 'trial' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                    org.subscriptionStatus === 'paused' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    {org.subscriptionStatus}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-sm max-w-xs text-gray-800 dark:text-gray-200">
                                {org.cancellationReason ? (
                                    <div className="text-xs">
                                        <p><span className="font-bold">Reason:</span> {org.cancellationReason}</p>
                                        {org.cancellationFeedback && <p className="truncate" title={org.cancellationFeedback}><span className="font-bold">Note:</span> {org.cancellationFeedback}</p>}
                                        {org.retentionOfferApplied && <p className="text-emerald-500 font-bold mt-1">✓ Offer Claimed</p>}
                                    </div>
                                ) : (
                                    <span className="text-gray-400 italic text-xs">No churn data</span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <Toggle label="Verified" enabled={!!org.isVerified} onChange={() => handleToggleVerified(org)} />
                                <div className="mt-2 text-xs">
                                     <Toggle label="Leading Pro" enabled={!!org.isLeadingPro} onChange={() => handleToggleLeadingPro(org)} />
                                </div>
                                <div className="mt-2 text-xs">
                                     <Toggle label="Virtual Worker AI" enabled={!!org.virtualWorkerEnabled} onChange={() => handleToggleVirtualWorker(org)} />
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-1">
                                    <Button size="sm" onClick={() => handleImpersonate(org)} variant="outline" title="Login as Admin">
                                        <LogIn className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" onClick={() => handleEditOrg(org)} variant="outline" title="Edit Organization">
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" onClick={() => handleDeleteOrg(org.id)} variant="danger" title="Delete Organization">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </Card>

            <Modal isOpen={creatingOrg || !!editingOrg} onClose={() => { setCreatingOrg(false); setEditingOrg(null); }} title={editingOrg ? "Edit Organization" : "Create New Organization"}>
                <form onSubmit={editingOrg ? handleUpdateOrg : handleCreateOrg} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Business Name" value={orgForm.name} onChange={e => setOrgForm({...orgForm, name: e.target.value})} required />
                        <Input label="Admin Email" type="email" value={orgForm.email} onChange={e => setOrgForm({...orgForm, email: e.target.value})} required />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Phone Number" value={orgForm.phone} onChange={e => setOrgForm({...orgForm, phone: e.target.value})} />
                        {!editingOrg && (
                            <div className="relative">
                                <Input label="Initial Admin Password" type={showOrgAdminPassword ? "text" : "password"} value={orgForm.adminPassword} onChange={e => setOrgForm({ ...orgForm, adminPassword: e.target.value })} required />
                                <button type="button" onClick={() => setShowOrgAdminPassword(!showOrgAdminPassword)} className="absolute bottom-2 right-3 text-gray-500" title="Toggle Password Visibility">
                                    <Eye size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <p className="text-sm font-bold mb-2">Location</p>
                        <Input label="Street Address" value={orgForm.address} onChange={e => setOrgForm({...orgForm, address: e.target.value})} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                            <Input label="City" value={orgForm.city} onChange={e => setOrgForm({...orgForm, city: e.target.value})} />
                            <Input label="State" value={orgForm.state} onChange={e => setOrgForm({...orgForm, state: e.target.value})} />
                            <Input label="ZIP Code" value={orgForm.zip} onChange={e => setOrgForm({...orgForm, zip: e.target.value})} />
                        </div>
                    </div>

                    <div className="border-t pt-4 mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Plan" value={orgForm.plan} onChange={e => setOrgForm({...orgForm, plan: e.target.value})} />
                        <Input label="Subscription Status" value={orgForm.subscriptionStatus} onChange={e => setOrgForm({...orgForm, subscriptionStatus: e.target.value})} />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="button" variant="ghost" onClick={() => { setCreatingOrg(false); setEditingOrg(null); }}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : (editingOrg ? 'Update Organization' : 'Create Organization')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default MasterOrganizations;
