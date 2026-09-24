import { cleanUndefinedFields } from '../../lib/utils';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Organization } from '../../types/types';
import { db, firebase } from '../../lib/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Table from '../../components/ui/Table';
import Card from '../../components/ui/Card';
import Toggle from '../../components/ui/Toggle';
import { Plus, Eye, Trash2, Edit, LogIn, Tag, Phone, Sparkles, HardDrive, Cpu, DollarSign, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { globalConfirm } from "lib/globalConfirm";
import WholesaleMarginBadge from '../../components/common/WholesaleMarginBadge';

const INITIAL_ORG_FORM = {
    name: '',
    email: '',
    phone: '',
    plan: 'starter',
    subscriptionStatus: 'active',
    address: '',
    city: '',
    state: '',
    zip: '',
    adminPassword: '',
    isFreeAccess: false,
    isComplimentary: false,
    billingExemptions: {
        twilio: false,
        ai: false,
        storage: false,
        hosting: true
    },
    isVerified: false,
    isLeadingPro: false,
    virtualWorkerEnabled: false,
    virtualWorkerBillingType: 'monthly' as 'monthly' | 'lifetime',
    aiVoiceAssistantEnabled: false,
    aiVoiceAssistantBillingType: 'monthly' as 'monthly' | 'lifetime',
    customDiscountPct: 0,
    subscriptionExpiryDate: '',
    customPricing: {
        customMonthlyPlanFee: '' as any,
        customSmsRate: '' as any,
        customVoiceRate: '' as any,
        customAiVoiceAssistantRate: '' as any,
        customAiVoiceAssistantMonthlyFee: '' as any,
        customPhoneLineFee: '' as any,
        customStorageOverageRate: '' as any,
        customAiTokenOverageRate: '' as any,
        customExcessUserFee: '' as any,
        customDivisionFee: '' as any,
        customVirtualWorkerFee: '' as any,
        customIncludedStorageGB: '' as any,
        customIncludedAiTokens: '' as any
    }
};

const MasterOrganizations: React.FC = () => {
    const { impersonateOrganization, state } = useAppContext();
    const { currentUser, isMasterAdmin, allOrganizations } = state;
    const navigate = useNavigate();
    
    const sortedOrgs = [...allOrganizations].sort((a, b) => {
        const getMs = (dateVal: any) => {
            if (!dateVal) return 0;
            if (dateVal.seconds) return dateVal.seconds * 1000; // Handle Firebase Timestamp Object
            return new Date(dateVal).getTime() || 0; // Handle standard ISO string
        };
        return getMs(b.createdAt) - getMs(a.createdAt);
    });

    const [creatingOrg, setCreatingOrg] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
    const [orgForm, setOrgForm] = useState(INITIAL_ORG_FORM);
    const [showOrgAdminPassword, setShowOrgAdminPassword] = useState(false);
    const [showCustomRates, setShowCustomRates] = useState(true);

    // Organizations are now driven by AppContext's state.allOrganizations
    // to prevent duplicate reads and synchronization drift.

    const getCleanedCustomPricing = (cp: any) => {
        if (!cp) return null;
        const cleaned: any = {};
        const keys = [
            'customMonthlyPlanFee', 'customSmsRate', 'customVoiceRate', 
            'customAiVoiceAssistantRate', 'customAiVoiceAssistantMonthlyFee',
            'customPhoneLineFee', 'customStorageOverageRate', 'customAiTokenOverageRate', 
            'customExcessUserFee', 'customDivisionFee', 'customVirtualWorkerFee', 
            'customIncludedStorageGB', 'customIncludedAiTokens'
        ];
        for (const k of keys) {
            if (cp[k] !== '' && cp[k] !== undefined && cp[k] !== null) {
                const val = Number(cp[k]);
                if (!isNaN(val)) {
                    cleaned[k] = val;
                }
            }
        }
        return Object.keys(cleaned).length > 0 ? cleaned : null;
    };

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
                isFreeAccess: orgForm.isFreeAccess,
                isComplimentary: orgForm.isComplimentary,
                billingExemptions: orgForm.billingExemptions,
                isVerified: false,
                virtualWorkerEnabled: orgForm.virtualWorkerEnabled,
                virtualWorkerBillingType: orgForm.virtualWorkerBillingType,
                aiVoiceAssistantEnabled: orgForm.aiVoiceAssistantEnabled,
                aiVoiceAssistantBillingType: orgForm.aiVoiceAssistantBillingType,
                customPricing: getCleanedCustomPricing(orgForm.customPricing),
                address: {
                    street: orgForm.address || '',
                    city: orgForm.city || '',
                    state: orgForm.state || '',
                    zip: orgForm.zip || '',
                },
                createdAt: new Date().toISOString(),
                createdBy: currentUser?.id || 'master_admin',
                ...(!isMasterAdmin && currentUser?.franchiseId ? { franchiseId: currentUser.franchiseId } : {})
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
            setOrgForm(INITIAL_ORG_FORM);
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
        
        // Handle legacy address formats
        const legacyAddress = typeof org.address === 'string' ? org.address : '';
        const addrObj = typeof org.address === 'object' && org.address !== null ? org.address : null;

        setOrgForm({
            name: org.name || '',
            email: org.email || '',
            phone: org.phone || (org as any).contactPhone || '',
            plan: (org.plan || 'starter') as string,
            subscriptionStatus: (org.subscriptionStatus || 'active') as string,
            address: addrObj?.street || legacyAddress || '',
            city: addrObj?.city || '',
            state: addrObj?.state || '',
            zip: addrObj?.zip || '',
            adminPassword: '',
            isFreeAccess: !!org.isFreeAccess,
            isComplimentary: !!org.isComplimentary,
            billingExemptions: {
                twilio: !!org.billingExemptions?.twilio,
                ai: !!org.billingExemptions?.ai,
                storage: !!org.billingExemptions?.storage,
                hosting: org.billingExemptions?.hosting !== false
            },
            isVerified: !!org.isVerified,
            isLeadingPro: !!org.isLeadingPro,
            virtualWorkerEnabled: !!org.virtualWorkerEnabled,
            virtualWorkerBillingType: (org as any).virtualWorkerBillingType || 'monthly',
            aiVoiceAssistantEnabled: !!org.aiVoiceAssistantEnabled,
            aiVoiceAssistantBillingType: (org as any).aiVoiceAssistantBillingType || 'monthly',
            customDiscountPct: org.customDiscountPct || 0,
            subscriptionExpiryDate: org.subscriptionExpiryDate || '',
            customPricing: {
                customMonthlyPlanFee: org.customPricing?.customMonthlyPlanFee ?? '',
                customSmsRate: org.customPricing?.customSmsRate ?? '',
                customVoiceRate: org.customPricing?.customVoiceRate ?? '',
                customAiVoiceAssistantRate: org.customPricing?.customAiVoiceAssistantRate ?? '',
                customAiVoiceAssistantMonthlyFee: org.customPricing?.customAiVoiceAssistantMonthlyFee ?? '',
                customPhoneLineFee: org.customPricing?.customPhoneLineFee ?? '',
                customStorageOverageRate: org.customPricing?.customStorageOverageRate ?? '',
                customAiTokenOverageRate: org.customPricing?.customAiTokenOverageRate ?? '',
                customExcessUserFee: org.customPricing?.customExcessUserFee ?? '',
                customDivisionFee: org.customPricing?.customDivisionFee ?? '',
                customVirtualWorkerFee: org.customPricing?.customVirtualWorkerFee ?? '',
                customIncludedStorageGB: org.customPricing?.customIncludedStorageGB ?? '',
                customIncludedAiTokens: org.customPricing?.customIncludedAiTokens ?? ''
            }
        });
    };

    const handleUpdateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrg) return;
        setIsSubmitting(true);
        try {
            const isExempt = !!orgForm.isFreeAccess || !!orgForm.isComplimentary;
            const finalStatus = (isExempt && (orgForm.subscriptionStatus === 'past_due' || orgForm.subscriptionStatus === 'trial'))
                ? 'active'
                : orgForm.subscriptionStatus;

            const updatePayload: any = {
                name: orgForm.name,
                email: orgForm.email,
                phone: orgForm.phone,
                plan: orgForm.plan,
                subscriptionStatus: finalStatus,
                address: {
                    street: orgForm.address,
                    city: orgForm.city,
                    state: orgForm.state,
                    zip: orgForm.zip,
                },
                isFreeAccess: orgForm.isFreeAccess,
                isComplimentary: orgForm.isComplimentary,
                billingExemptions: orgForm.billingExemptions,
                isVerified: orgForm.isVerified,
                isLeadingPro: orgForm.isLeadingPro,
                virtualWorkerEnabled: orgForm.virtualWorkerEnabled,
                virtualWorkerBillingType: orgForm.virtualWorkerBillingType,
                aiVoiceAssistantEnabled: orgForm.aiVoiceAssistantEnabled,
                aiVoiceAssistantBillingType: orgForm.aiVoiceAssistantBillingType,
                customDiscountPct: Number(orgForm.customDiscountPct) || 0,
                customPricing: getCleanedCustomPricing(orgForm.customPricing),
                subscriptionExpiryDate: orgForm.subscriptionExpiryDate || null
            };

            if (finalStatus === 'active' || isExempt) {
                updatePayload.pastDueSince = firebase.firestore.FieldValue.delete();
            }

            await db.collection('organizations').doc(editingOrg.id).update(cleanUndefinedFields(updatePayload));
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
                await db.collection('organizations').doc(orgId).delete();
                toast.success('Organization deleted successfully!');
            } catch (error: any) {
                toast.error(`Failed to delete organization: ${error.message}`);
            }
        }
    };

    const handleToggleVerified = async (org: Organization) => {
        try {
            await db.collection('organizations').doc(org.id).update(cleanUndefinedFields({ isVerified: !org.isVerified }));
            toast.success(`Verification status updated for ${org.name}`);
        } catch (error) {
            toast.error("Failed to update verification status.");
        }
    };

    const handleToggleLeadingPro = async (org: Organization) => {
        try {
            await db.collection('organizations').doc(org.id).update(cleanUndefinedFields({ isLeadingPro: !org.isLeadingPro }));
            toast.success(`Leading Pro status updated for ${org.name}`);
        } catch (error) {
            toast.error("Failed to update Leading Pro status.");
        }
    };

    const handleToggleVirtualWorker = async (org: Organization) => {
        try {
            await db.collection('organizations').doc(org.id).update(cleanUndefinedFields({ virtualWorkerEnabled: !org.virtualWorkerEnabled }));
            toast.success(`Virtual Worker status updated for ${org.name}`);
        } catch (error) {
            toast.error("Failed to update Virtual Worker status.");
        }
    };

    const formatLastLogin = (dateVal?: any) => {
        if (!dateVal) return <span className="text-gray-400 italic text-xs">Never</span>;
        try {
            const rawStr = dateVal.seconds ? new Date(dateVal.seconds * 1000).toISOString() : dateVal;
            const d = new Date(rawStr);
            if (isNaN(d.getTime())) return <span className="text-gray-400 italic text-xs">Never</span>;
            return (
                <div className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    <div>{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-400 font-mono">{d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            );
        } catch {
            return <span className="text-gray-400 italic text-xs">Never</span>;
        }
    };

    const headers = ['Name/Email', 'Plan Info', 'Status', 'Last Login', 'Retention/Churn Data', 'Verified', 'Actions'];

    const isAllowed = isMasterAdmin || currentUser?.role === 'franchise_admin';
    if (!isAllowed) return <div className="p-6">You are not authorized to view this page.</div>;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Organizations</h1>
                <Button onClick={() => { setOrgForm(INITIAL_ORG_FORM); setCreatingOrg(true); }}>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Organization
                </Button>
            </div>

            <Card className="overflow-x-auto">
                <Table headers={headers}>
                    {sortedOrgs.map(org => (
                        <tr key={org.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{org.name || 'Unnamed Org'}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{org.email || org.id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900 dark:text-white uppercase">{org.plan}</div>
                                {org.customDiscountPct > 0 && <span className="text-xs text-emerald-500 font-bold">{org.customDiscountPct}% Off Applied</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex flex-col gap-1 items-start">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        org.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        org.subscriptionStatus === 'trial' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                        org.subscriptionStatus === 'paused' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {org.subscriptionStatus}
                                    </span>
                                    {(org.isFreeAccess || org.isComplimentary) && (
                                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/50">
                                            {org.isComplimentary ? 'Complimentary' : 'Free Access'}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {formatLastLogin(org.lastLoginAt)}
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
                                <div className="mt-2 text-xs flex flex-col gap-1">
                                     <Toggle label="Virtual Worker AI" enabled={!!org.virtualWorkerEnabled} onChange={() => handleToggleVirtualWorker(org)} />
                                     {!!org.virtualWorkerEnabled && (
                                         <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 capitalize bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 rounded w-max">
                                             {(org as any).virtualWorkerBillingType || 'monthly'}
                                         </span>
                                     )}
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input label="Custom Discount %" type="number" value={orgForm.customDiscountPct} onChange={e => setOrgForm({...orgForm, customDiscountPct: Number(e.target.value)})} />
                        <Input label="Expiry Date" type="date" value={orgForm.subscriptionExpiryDate ? (orgForm.subscriptionExpiryDate.includes('T') ? orgForm.subscriptionExpiryDate.split('T')[0] : orgForm.subscriptionExpiryDate) : ''} onChange={e => setOrgForm({...orgForm, subscriptionExpiryDate: e.target.value})} />
                        <div className="flex flex-col justify-end pb-2">
                             <Toggle 
                                label="Free Access" 
                                enabled={orgForm.isFreeAccess} 
                                onChange={() => {
                                    const nextFree = !orgForm.isFreeAccess;
                                    setOrgForm(prev => ({
                                        ...prev,
                                        isFreeAccess: nextFree,
                                        subscriptionStatus: nextFree && (prev.subscriptionStatus === 'past_due' || prev.subscriptionStatus === 'trial') ? 'active' : prev.subscriptionStatus
                                    }));
                                }} 
                            />
                        </div>
                    </div>

                    {/* Infrastructure & Metered Billing Controls */}
                    <div className="bg-indigo-50/70 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/60 space-y-3 mt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Infrastructure Billing Controls</h4>
                                <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">Manage complimentary access & resource billing exemptions per service</p>
                            </div>
                            <Toggle 
                                label="Complimentary Access (Exempt All)" 
                                enabled={orgForm.isComplimentary} 
                                onChange={() => {
                                    const nextComp = !orgForm.isComplimentary;
                                    setOrgForm(prev => ({
                                        ...prev,
                                        isComplimentary: nextComp,
                                        subscriptionStatus: nextComp && (prev.subscriptionStatus === 'past_due' || prev.subscriptionStatus === 'trial') ? 'active' : prev.subscriptionStatus
                                    }));
                                }} 
                            />
                        </div>

                        {!orgForm.isComplimentary && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-indigo-200/60 dark:border-indigo-800/50">
                                <Toggle 
                                    label="Exempt Twilio" 
                                    enabled={orgForm.billingExemptions?.twilio || false} 
                                    onChange={() => setOrgForm({
                                        ...orgForm, 
                                        billingExemptions: { ...orgForm.billingExemptions, twilio: !orgForm.billingExemptions?.twilio }
                                    })} 
                                />
                                <Toggle 
                                    label="Exempt AI Tokens" 
                                    enabled={orgForm.billingExemptions?.ai || false} 
                                    onChange={() => setOrgForm({
                                        ...orgForm, 
                                        billingExemptions: { ...orgForm.billingExemptions, ai: !orgForm.billingExemptions?.ai }
                                    })} 
                                />
                                <Toggle 
                                    label="Exempt Storage" 
                                    enabled={orgForm.billingExemptions?.storage || false} 
                                    onChange={() => setOrgForm({
                                        ...orgForm, 
                                        billingExemptions: { ...orgForm.billingExemptions, storage: !orgForm.billingExemptions?.storage }
                                    })} 
                                />
                                <div className="text-xs text-slate-500 flex items-center font-semibold gap-1">
                                    <span>🌐 Hosting:</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Included in Plan</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Negotiated Client Rates & Billing Overrides (Per-Organization) */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 mt-4">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowCustomRates(!showCustomRates)}>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black">
                                    <Tag size={16} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Negotiated Client Rates &amp; Overrides
                                        <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold uppercase">
                                            Individual Pricing
                                        </span>
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Override platform global rates for this specific company. Leave blank to inherit global defaults.
                                    </p>
                                </div>
                            </div>
                            <Button type="button" variant="ghost" size="sm" className="text-slate-500">
                                {showCustomRates ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </Button>
                        </div>

                        {showCustomRates && (
                            <div className="space-y-6 pt-3 border-t border-slate-200 dark:border-slate-800">
                                {/* Base Plan & User Seat Overrides */}
                                <div>
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Subscription &amp; Seat Overrides</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom Monthly Plan Fee ($)</label>
                                                {orgForm.customPricing.customMonthlyPlanFee !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customMonthlyPlanFee: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default Plan Price"
                                                type="number" 
                                                value={orgForm.customPricing.customMonthlyPlanFee} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customMonthlyPlanFee: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customMonthlyPlanFee || 0} unit="/mo" isSoftwareLicense={true} provider="Software License" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom Excess User Fee ($/mo)</label>
                                                {orgForm.customPricing.customExcessUserFee !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customExcessUserFee: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $25/mo"
                                                type="number" 
                                                value={orgForm.customPricing.customExcessUserFee} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customExcessUserFee: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customExcessUserFee || 0} unit="/user" isSoftwareLicense={true} provider="Software License" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom Division Fee ($/mo)</label>
                                                {orgForm.customPricing.customDivisionFee !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customDivisionFee: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $79/mo"
                                                type="number" 
                                                value={orgForm.customPricing.customDivisionFee} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customDivisionFee: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customDivisionFee || 0} unit="/division" isSoftwareLicense={true} provider="Software License" />
                                        </div>
                                    </div>
                                </div>

                                {/* Telephony Custom Overrides */}
                                <div>
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Telephony &amp; Messaging Overrides (Twilio)</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom SMS Rate ($/msg)</label>
                                                {orgForm.customPricing.customSmsRate !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customSmsRate: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $0.020"
                                                type="number" 
                                                step="0.001"
                                                value={orgForm.customPricing.customSmsRate} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customSmsRate: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customSmsRate || 0} wholesaleCost={0.012} unit="/msg" provider="Twilio & Carriers" customNote="Twilio $0.0079 + carrier" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom Voice Rate ($/min)</label>
                                                {orgForm.customPricing.customVoiceRate !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customVoiceRate: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $0.035"
                                                type="number" 
                                                step="0.001"
                                                value={orgForm.customPricing.customVoiceRate} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customVoiceRate: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customVoiceRate || 0} wholesaleCost={0.014} unit="/min" provider="Twilio Voice" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom AI Voice Rate ($/min)</label>
                                                {orgForm.customPricing.customAiVoiceAssistantRate !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customAiVoiceAssistantRate: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $0.07/min"
                                                type="number" 
                                                step="0.005"
                                                value={orgForm.customPricing.customAiVoiceAssistantRate} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customAiVoiceAssistantRate: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customAiVoiceAssistantRate || 0} wholesaleCost={0.040} unit="/min" provider="Twilio + Polly + Gemini" customNote="Twilio $0.014 + ASR $0.020 + Polly $0.006" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom Phone Line Fee ($/mo)</label>
                                                {orgForm.customPricing.customPhoneLineFee !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customPhoneLineFee: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $15.00"
                                                type="number" 
                                                step="1"
                                                value={orgForm.customPricing.customPhoneLineFee} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customPhoneLineFee: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customPhoneLineFee || 0} wholesaleCost={1.15} unit="/line/mo" provider="Twilio PBX" />
                                        </div>
                                    </div>
                                </div>

                                {/* Storage & AI Token Overrides */}
                                <div>
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Storage &amp; AI Intelligence Overrides (Gemini 3.8 Flash)</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Storage Overage ($/GB)</label>
                                                {orgForm.customPricing.customStorageOverageRate !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customStorageOverageRate: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $0.10/GB"
                                                type="number" 
                                                step="0.01"
                                                value={orgForm.customPricing.customStorageOverageRate} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customStorageOverageRate: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customStorageOverageRate || 0} wholesaleCost={0.026} unit="/GB" provider="Google Cloud Storage" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">AI Token Overage ($/1k tokens)</label>
                                                {orgForm.customPricing.customAiTokenOverageRate !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customAiTokenOverageRate: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $0.002"
                                                type="number" 
                                                step="0.0005"
                                                value={orgForm.customPricing.customAiTokenOverageRate} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customAiTokenOverageRate: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customAiTokenOverageRate || 0} wholesaleCost={0.00018} unit="/1k tokens" provider="Gemini 3.8 Flash" customNote="~$0.18 / 1M tokens" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Custom Virtual Worker Fee ($/mo)</label>
                                                {orgForm.customPricing.customVirtualWorkerFee !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customVirtualWorkerFee: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $49.99/mo"
                                                type="number" 
                                                step="1"
                                                value={orgForm.customPricing.customVirtualWorkerFee} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customVirtualWorkerFee: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customVirtualWorkerFee || 0} wholesaleCost={2.50} unit="/mo" provider="Gemini 3.8 Flash" customNote="~$1.50-$3.50/mo API cost" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">AI Voice Receptionist Fee ($/mo)</label>
                                                {orgForm.customPricing.customAiVoiceAssistantMonthlyFee !== '' && (
                                                    <button type="button" onClick={() => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customAiVoiceAssistantMonthlyFee: ''}})} className="text-[10px] text-red-500 flex items-center gap-0.5 hover:underline">
                                                        <RotateCcw size={10} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                            <Input 
                                                placeholder="Default: $5.00/mo"
                                                type="number" 
                                                step="1"
                                                value={orgForm.customPricing.customAiVoiceAssistantMonthlyFee} 
                                                onChange={e => setOrgForm({...orgForm, customPricing: {...orgForm.customPricing, customAiVoiceAssistantMonthlyFee: e.target.value}})} 
                                            />
                                            <WholesaleMarginBadge retailPrice={orgForm.customPricing.customAiVoiceAssistantMonthlyFee || 0} isSoftwareLicense={true} unit="/mo" provider="Software License" customNote="Flat monthly unlock per organization" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t pt-4">
                        <Toggle label="Verified" enabled={orgForm.isVerified} onChange={() => setOrgForm({...orgForm, isVerified: !orgForm.isVerified})} />
                        <Toggle label="Leading Pro" enabled={orgForm.isLeadingPro} onChange={() => setOrgForm({...orgForm, isLeadingPro: !orgForm.isLeadingPro})} />
                        <div className="space-y-2">
                            <Toggle label="Virtual Worker AI" enabled={orgForm.virtualWorkerEnabled} onChange={() => setOrgForm({...orgForm, virtualWorkerEnabled: !orgForm.virtualWorkerEnabled})} />
                            {orgForm.virtualWorkerEnabled && (
                                <div className="mt-2">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Virtual Worker Billing</label>
                                    <select
                                        value={orgForm.virtualWorkerBillingType || 'monthly'}
                                        onChange={e => setOrgForm({...orgForm, virtualWorkerBillingType: e.target.value as any})}
                                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm"
                                        title="Virtual Worker Billing Type"
                                    >
                                        <option value="monthly">Monthly Subscription</option>
                                        <option value="lifetime">Lifetime Access</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Toggle label="24/7 AI Voice Receptionist" enabled={orgForm.aiVoiceAssistantEnabled} onChange={() => setOrgForm({...orgForm, aiVoiceAssistantEnabled: !orgForm.aiVoiceAssistantEnabled})} />
                            {orgForm.aiVoiceAssistantEnabled && (
                                <div className="mt-2">
                                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">AI Voice Billing</label>
                                    <select
                                        value={orgForm.aiVoiceAssistantBillingType || 'monthly'}
                                        onChange={e => setOrgForm({...orgForm, aiVoiceAssistantBillingType: e.target.value as any})}
                                        className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm"
                                        title="AI Voice Assistant Billing Type"
                                    >
                                        <option value="monthly">Monthly Subscription ($5/mo)</option>
                                        <option value="lifetime">Lifetime Access ($199 one-time)</option>
                                    </select>
                                </div>
                            )}
                        </div>
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
