import { getBaseUrl } from "lib/utils";

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle'; 
import { useAppContext } from 'context/AppContext';
import { db, auth } from 'lib/firebase';
import type { User } from 'types';
import { User as UserIcon, Lock, Mail, Camera, RefreshCw, CheckCircle, Sparkles, Key, Trash2, DollarSign, Settings, Search, Filter, Eye, EyeOff, FileText, Upload, Download } from 'lucide-react';
import HRHandbookView from '../../pages/admin/compliance/components/HRHandbookView';
import { encryptSensitiveData, decryptSensitiveData } from 'lib/encryption';
import { sendEmail } from 'lib/notificationService';
import { uploadFileToStorage } from 'lib/storageService';
import showToast from 'lib/toast';

interface EmployeeProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: Partial<User>;
    isSelf?: boolean;
}


const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({ isOpen, onClose, employee: initialData, isSelf: isSelfProp = false }) => {
    const { state, dispatch } = useAppContext();
    
    const isOrgAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin';
    const isSelf = !!isSelfProp;
    const [formData, setFormData] = useState<Partial<User>>(initialData);
    const [activeTab, setActiveTab] = useState<'details' | 'roles' | 'permissions' | 'payroll' | 'hr_files' | 'security'>('details');
    const [showSensitive, setShowSensitive] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isUploadingPic, setIsUploadingPic] = useState(false);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [hrFileLabel, setHrFileLabel] = useState('');
    const [hrFileType, setHrFileType] = useState('');
    const [hrNewType, setHrNewType] = useState('');
    const [hrFileDesc, setHrFileDesc] = useState('');
    const [hrFileVisible, setHrFileVisible] = useState(false);
    const [hrFileObj, setHrFileObj] = useState<File | null>(null);
    const [isUploadingHR, setIsUploadingHR] = useState(false);
    const [hrSearchQuery, setHrSearchQuery] = useState('');
    const [hrTypeFilter, setHrTypeFilter] = useState('All');
    const [viewerDoc, setViewerDoc] = useState<any | null>(null);

    useEffect(() => {
        const decryptFields = async () => {
            if (!initialData.id || !state.currentOrganization?.id) return;
            setIsDecrypting(true);
            const orgId = state.currentOrganization.id;
            try {
                let decryptedSsn = initialData.ssn || '';
                if (decryptedSsn && decryptedSsn.length > 20) decryptedSsn = await decryptSensitiveData(decryptedSsn, orgId);
                let decryptedPay = initialData.payRate || 0;
                if (typeof decryptedPay === 'string' && decryptedPay.length > 20) {
                    const val = await decryptSensitiveData(decryptedPay, orgId);
                    decryptedPay = parseFloat(val) || 0;
                }
                setFormData(prev => ({ ...prev, ssn: decryptedSsn, payRate: decryptedPay }));
            } catch (e) { console.error(e); } finally { setIsDecrypting(false); }
        };
        if (isOpen && !isSelf) decryptFields(); 
        if (isOpen && isSelf) setFormData(initialData); 
    }, [isOpen, initialData.id, state.currentOrganization?.id, isSelf]);

    const handleResetPassword = async () => {
        if (!formData.email) { showToast.warn("User email is required."); return; }
        setIsResetting(true);
        try { await auth.sendPasswordResetEmail(formData.email); showToast.success(`Reset link sent.`); }
        catch (err: any) { showToast.error("Error: " + err.message); }
        finally { setIsResetting(false); }
    };
    
    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) { showToast.warn("Passwords do not match."); return; }
        if (newPassword.length < 6) { showToast.warn("Password must be at least 6 characters."); return; }
        setIsUpdatingPassword(true);
        try { await auth.currentUser?.updatePassword(newPassword); showToast.success("Password updated!"); setNewPassword(''); setConfirmPassword(''); }
        catch (err: any) { showToast.error("Error: " + err.message); }
        finally { setIsUpdatingPassword(false); }
    };

    const handleResetOverlays = () => {
        localStorage.removeItem('virtual-worker-hidden');
        localStorage.removeItem('virtual-worker-pos');
        localStorage.removeItem('live-support-hidden');
        localStorage.removeItem('live-support-pos');
        showToast.success("UI bubbles reset. Refreshing...");
        window.location.reload();
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            if (formData.id) {
                await db.collection('users').doc(formData.id).update({ status: 'archived', deleted: true });
            }
            if (auth.currentUser) {
                await auth.currentUser.delete();
            }
        } catch (error: any) {
            console.error("Account Deletion Error:", error);
            if (error.code === 'auth/requires-recent-login') {
                showToast.warn("For security purposes, please log out and log back in to authenticate before deleting your account.");
            } else {
                showToast.error("Failed to delete account. Please contact support.");
            }
            setIsDeleting(false);
        }
    };

    const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast.warn("File too large. Profile pictures must be under 5MB.");
            e.target.value = '';
            return;
        }

        setIsUploadingPic(true);
        try {
            const orgId = state.currentOrganization?.id || 'unknown';
            const userId = formData.id || 'new-user';
            const path = `organizations/${orgId}/users/${userId}/profilePic_${Date.now()}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            setFormData(prev => ({ ...prev, profilePicUrl: downloadUrl }));
        } catch (err) { console.error(err); showToast.error("Failed to upload profile picture."); }
        finally { setIsUploadingPic(false); }
    };
    
    const handleUploadHR = async () => {
        if (!hrFileObj || !hrFileLabel || !hrFileType) return;
        setIsUploadingHR(true);
        let finalType = hrFileType;
        try {
            if (hrFileType === '_custom_') {
                finalType = hrNewType.trim() || 'Other';
                const orgCats = state.currentOrganization?.hrFileCategories || ['Drug Test', 'Writeup', 'License', 'Time Off', 'Onboarding', 'Other'];
                if (!orgCats.includes(finalType) && state.currentOrganization?.id) {
                    const newCats = [...orgCats, finalType];
                    await db.collection('organizations').doc(state.currentOrganization.id).update({ hrFileCategories: newCats });
                    dispatch({ type: 'UPDATE_ORGANIZATION', payload: { ...state.currentOrganization, hrFileCategories: newCats } as any });
                }
            }
            const orgId = state.currentOrganization?.id || 'unknown';
            const userId = formData.id || 'new-user';
            const path = `organizations/${orgId}/users/${userId}/hrFiles/${Date.now()}_${hrFileObj.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
            const downloadUrl = await uploadFileToStorage(path, hrFileObj);
            
            const newDoc = { 
                id: `hrdoc-${Date.now()}`, 
                organizationId: state.currentOrganization?.id || '', 
                fileName: hrFileObj.name, 
                label: hrFileLabel, 
                dataUrl: downloadUrl, // Mapped to the Firebase Storage URL instead of Base64
                createdAt: new Date().toISOString(),
                fileType: finalType,
                isVisibleToEmployee: hrFileVisible,
                uploadedBy: state.currentUser?.id,
                description: hrFileDesc,
                tags: []
            };
            setFormData(prev => ({ ...prev, documents: [...(prev.documents || []), newDoc] }));
            setHrFileObj(null); setHrFileLabel(''); setHrFileDesc(''); setHrFileType(''); setHrFileVisible(false); setHrNewType('');
        } catch (e) { showToast.error("Failed to process file."); }
        finally { setIsUploadingHR(false); }
    };
    
    const handleDeleteHR = async (id: string) => {
        setFormData(prev => ({ ...prev, documents: (prev.documents || []).filter(d => d.id !== id) }));
    };
    
    const toggleHRVisibility = (id: string) => {
        setFormData(prev => ({ 
            ...prev, 
            documents: (prev.documents || []).map(d => d.id === id ? { ...d, isVisibleToEmployee: !d.isVisibleToEmployee } : d) 
        }));
    };
    
    const handleTogglePermission = (perm: string) => {
        const current = formData.permissions || [];
        if (current.includes(perm)) {
            setFormData({ ...formData, permissions: current.filter(p => p !== perm) });
        } else {
            setFormData({ ...formData, permissions: [...current, perm] });
        }
    };

    const handleSendInvite = async () => {
        const { name: orgName, id: orgId } = state.currentOrganization || {};
        const normalizedEmail = (formData.email || '').toLowerCase().trim();
        if (!orgName || !orgId || !normalizedEmail) return;

        const fullName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
        const inviteLink = `${getBaseUrl()}/#/register?view=register_user&userType=staff&email=${encodeURIComponent(normalizedEmail)}&name=${encodeURIComponent(fullName)}&oid=${orgId}`;
        const subject = `Join ${orgName} on TekTrakker`;

        const htmlBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Invitation from ${orgName}</h2>
                <p>Hi ${formData.firstName || 'there'},</p>
                <p>${orgName} has invited you to join their team on <strong>TekTrakker</strong>.</p>
                <p style="margin: 30px 0;">
                    <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation & Setup Account</a>
                </p>
                <p style="font-size: 12px; color: #666;">If the button above doesn't work, copy and paste this link into your browser:<br/>
                <a href="${inviteLink}">${inviteLink}</a></p>
                <br/>
                <p>Thanks,<br/>The TekTrakker Team</p>
            </div>
        `;

        try {
            await sendEmail(state.currentOrganization, {
                to: [normalizedEmail],
                message: { subject, html: htmlBody },
                type: 'Invite'
            });
            showToast.success("Invitation email sent!");
        } catch (e) { showToast.error("Failed to send invite."); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!state.currentOrganization) return;
        const isOfflineOnly = formData.hasAppAccess === false;
        const normalizedEmail = (formData.email || '').toLowerCase().trim();
        if (!formData.firstName || !formData.lastName) { showToast.warn("First and Last Name are required."); return; }
        if (!isOfflineOnly && !normalizedEmail && !formData.id) { showToast.warn("Email is required for App Access users."); return; }
        if (isOfflineOnly && (!formData.kioskPin || formData.kioskPin.length !== 4)) { showToast.warn("A 4-digit Kiosk PIN is required for Offline employees."); return; }
        setIsSaving(true);
        const orgId = state.currentOrganization.id;
        const id = formData.id || (isOfflineOnly ? `kiosk-${Date.now()}` : normalizedEmail);
        try {
            let finalPayRate = formData.payRate;
            let finalSsn = formData.ssn;
            if (!isSelf) {
                 finalSsn = formData.ssn ? await encryptSensitiveData(formData.ssn, orgId) : null;
                 finalPayRate = await encryptSensitiveData(formData.payRate || 0, orgId);
            }
            const finalData: any = {
                ...formData, 
                id, organizationId: orgId, email: isOfflineOnly ? null : normalizedEmail,
                username: formData.username || (isOfflineOnly ? formData.firstName : normalizedEmail.split('@')[0]),
                firstName: formData.firstName || '', lastName: formData.lastName || '', 
                status: formData.status || 'active'
            };
            if (!isSelf) {
                finalData.role = formData.role || 'employee';
                finalData.payRate = finalPayRate;
                finalData.ssn = finalSsn;
                finalData.squareTeamMemberId = (formData as any).squareTeamMemberId || null;
            }
            Object.keys(finalData).forEach(key => finalData[key] === undefined && delete finalData[key]);
            
            // Log for debugging
            console.log("Saving user profile:", id, finalData);
            
            if (formData.id) await db.collection('users').doc(id).update(finalData);
            else await db.collection('users').doc(id).set(finalData);
            dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...initialData, ...finalData } as User });
            onClose();
        } catch (error: any) { 
            console.error("Save Error Details:", error);
            showToast.error("Error saving profile: " + (error.message || "Unknown Error")); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const availablePermissions = [
        { id: 'view_financials', label: 'View Financials/Sales', desc: 'Allows access to company revenue and growth data.' },
        { id: 'manage_inventory', label: 'Manage Inventory', desc: 'Allows editing stock levels and creating parts.' },
        { id: 'manage_dispatch', label: 'Manage Dispatch', desc: 'Allows scheduling and assigning jobs to others.' },
        { id: 'view_customers', label: 'View Customer DB', desc: 'Full access to customer list and history.' },
        { id: 'manage_marketing', label: 'Manage Marketing', desc: 'Access to campaign spending and ROI.' },
        { id: 'view_refrigerant', label: 'Access Refrigerant Logs', desc: 'Required for EPA compliance oversight.' },
        { id: 'manage_fleet', label: 'Manage Fleet/Vehicles', desc: 'Access to vehicle logs and mileage tracking.' }
    ];

    const allowedTabs = isSelf 
        ? ['details', 'hr_files', 'security', ...(isOrgAdmin ? ['roles', 'permissions', 'payroll'] : [])] 
        : ['details', 'roles', 'permissions', 'payroll', 'hr_files'];

    const activeHRCats = state.currentOrganization?.hrFileCategories || ['Drug Test', 'Writeup', 'License', 'Time Off', 'Onboarding', 'Other'];

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={formData.id ? (isSelfProp ? "My Profile" : "Edit Employee") : "New Employee"} size="xl">
                <div className="flex flex-col md:flex-row gap-6 h-full max-h-[75vh]">
                    <div className="w-full md:w-1/3 flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                        <div className="relative group">
                            <div className="w-32 h-32 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-5xl text-gray-500 mb-4 overflow-hidden border-4 border-white dark:border-gray-800 shadow-md">
                                {formData.profilePicUrl ? <img src={formData.profilePicUrl} className="w-full h-full object-cover" alt="Profile" /> : <UserIcon size={48} />}
                            </div>
                            <label className="absolute bottom-4 right-0 p-2 bg-primary-600 text-white rounded-full shadow-lg cursor-pointer hover:bg-primary-700 transition-colors">
                                <Camera size={16} /><input type="file" className="hidden" accept="image/*" onChange={handleProfilePicUpload} title="Upload Profile Picture" aria-label="Upload Profile Picture" />
                            </label>
                        </div>
                        <h3 className="font-bold text-lg dark:text-white text-center">{formData.firstName} {formData.lastName}</h3>
                        <div className="mt-4 p-4 bg-white dark:bg-slate-800 border rounded-xl w-full text-center">
                            <p className="text-[10px] font-mono text-slate-500">{formData.digitalId || 'PENDING'}</p>
                            <p className="text-xs font-black uppercase text-slate-900 dark:text-white">{formData.role?.replace('_', ' ')}</p>
                        </div>
                    </div>

                    <div className="w-full md:w-2/3 flex flex-col">
                        <div className="flex border-b dark:border-gray-700 mb-4 overflow-x-auto">
                            {allowedTabs.map(tab => (
                                <button key={tab} type="button" onClick={() => setActiveTab(tab as any)} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{tab === 'hr_files' ? 'HR Files' : tab}</button>
                            ))}
                        </div>
                        <form noValidate onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                            {activeTab === 'details' && (
                                <><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="First Name" value={formData.firstName || ''} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                                    <Input label="Last Name" value={formData.lastName || ''} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                                </div>
                                {!isSelf && (
                                    <div className="my-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                                        <Toggle 
                                            label="TekTrakker App Access"
                                            description="If disabled, this user cannot login. They exist strictly for Kiosk clock-ins & Payroll."
                                            enabled={formData.hasAppAccess !== false} 
                                            onChange={(val) => setFormData({...formData, hasAppAccess: val})} 
                                        />
                                    </div>
                                )}
                                {formData.hasAppAccess !== false && (
                                    <Input label="Email Address" type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} required={!isSelf} disabled={isSelf} />
                                )}
                                <Input label="Kiosk Access PIN (4 Digits)" type="text" maxLength={4} value={formData.kioskPin || ''} onChange={e => setFormData({...formData, kioskPin: e.target.value.replace(/\D/g, '')})} placeholder="1234" />
                                <Input label="Phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /></>
                            )}
                            
                            {activeTab === 'roles' && (!isSelf || isOrgAdmin) && (
                                <div className="space-y-6">
                                    <Select label="System Role" value={formData.role || 'employee'} onChange={e => setFormData({...formData, role: e.target.value as any})} disabled={isSelf}>
                                        <option value="employee">Technician</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="admin">Admin</option>
                                        <option value="both">Superuser</option>
                                    </Select>
                                </div>
                            )}

                            {activeTab === 'permissions' && (!isSelf || isOrgAdmin) && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Settings size={18}/> Page Access Controls</h4>
                                    <p className="text-xs text-slate-500 mb-4">Grant or revoke access to specific platform areas regardless of role.</p>
                                    <div className="space-y-2">
                                        {availablePermissions.map(p => (
                                            <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border rounded-lg hover:border-primary-500 transition-colors cursor-pointer" onClick={() => handleTogglePermission(p.id)}>
                                                <div>
                                                    <p className="text-sm font-bold">{p.label}</p>
                                                    <p className="text-[10px] text-slate-500">{p.desc}</p>
                                                </div>
                                                <div className={`w-10 h-6 rounded-full relative transition-colors ${formData.permissions?.includes(p.id) ? 'bg-primary-600' : 'bg-slate-300'}`}>
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.permissions?.includes(p.id) ? 'left-5' : 'left-1'}`}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {activeTab === 'payroll' && (!isSelf || isOrgAdmin) && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><h4 className="font-bold flex items-center gap-2 dark:text-white"><Lock size={14}/> Encrypted Data</h4><button type="button" onClick={() => setShowSensitive(!showSensitive)} className="text-xs text-gray-500">{showSensitive ? 'Hide' : 'Reveal'}</button></div>
                                    <div className={!showSensitive ? 'blur-sm select-none' : ''}>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border space-y-4 mb-4">
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <Select label="Pay Type" value={formData.payType || 'hourly'} onChange={e => setFormData({...formData, payType: e.target.value as any})}>
                                                        <option value="hourly">Hourly Rate</option>
                                                        <option value="salary">Annual Salary</option>
                                                    </Select>
                                                </div>
                                                <div className="flex-1">
                                                    <Input 
                                                        label={formData.payType === 'salary' ? "Salary Amount ($)" : "Pay Rate ($/hr)"} 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={isNaN(formData.payRate as number) ? '' : formData.payRate} 
                                                        onChange={e => setFormData({...formData, payRate: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                                    />
                                                </div>
                                            </div>
                                            <Input label="SSN" value={formData.ssn || ''} onChange={e => setFormData({...formData, ssn: e.target.value})} placeholder="XXX-XX-XXXX" />
                                        </div>
                                        <h5 className="font-bold text-sm text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2"><DollarSign size={14}/> W-4 Withholding</h5>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border rounded-lg space-y-3">
                                            <Select label="Filing Status" value={formData.w4Status || 'Single'} onChange={e => setFormData({...formData, w4Status: e.target.value as any})}>
                                                <option value="Single">Single / Married Filing Separately</option>
                                                <option value="Married">Married Filing Jointly</option>
                                                <option value="Head of Household">Head of Household</option>
                                            </Select>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <Input 
                                                    label="Dependents ($)" 
                                                    type="number" 
                                                    value={isNaN(formData.w4DependentsAmount!) ? '' : formData.w4DependentsAmount} 
                                                    onChange={e => setFormData({...formData, w4DependentsAmount: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                                />
                                                <Input 
                                                    label="Extra Withholding ($)" 
                                                    type="number" 
                                                    value={isNaN(formData.w4ExtraWithholding!) ? '' : formData.w4ExtraWithholding} 
                                                    onChange={e => setFormData({...formData, w4ExtraWithholding: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                                                />
                                            </div>
                                        </div>
                                        <h5 className="font-bold text-sm text-slate-600 dark:text-slate-400 mt-4 mb-2 flex items-center gap-2"><Key size={14}/> Integrations & API</h5>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border rounded-lg space-y-3">
                                            <Input 
                                                label="Square Team Member ID (Optional)" 
                                                value={(formData as any).squareTeamMemberId || ''} 
                                                onChange={e => setFormData({...formData, squareTeamMemberId: e.target.value} as any)} 
                                                placeholder="TMA..." 
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {activeTab === 'hr_files' && (
                                <div className="space-y-4">
                                    <div className="mb-6">
                                        <HRHandbookView employee={formData as User} isSelf={isSelf} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><FileText size={16}/> HR File System</h4>
                                    </div>
                                    {(!isSelf || isOrgAdmin) && (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <Input label="Document Title" value={hrFileLabel} onChange={e => setHrFileLabel(e.target.value)} />
                                                <div className="space-y-2">
                                                    <Select label="File Type" value={hrFileType} onChange={e => setHrFileType(e.target.value)}>
                                                        <option value="">-- Select Type --</option>
                                                        {activeHRCats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        <option value="_custom_" className="font-bold text-primary-600">+ Add Custom Type...</option>
                                                    </Select>
                                                    {hrFileType === '_custom_' && (
                                                        <Input label="New Category Name" value={hrNewType} onChange={e => setHrNewType(e.target.value)} placeholder="e.g. Performance Review" />
                                                    )}
                                                </div>
                                            </div>
                                            <Input label="Description / Notes (Optional)" value={hrFileDesc} onChange={e => setHrFileDesc(e.target.value)} />
                                            <div className="flex items-center justify-between mt-2">
                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                                    <input type="checkbox" checked={hrFileVisible} onChange={e => setHrFileVisible(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 bg-white border-slate-300" />
                                                    Visible to Employee
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input type="file" onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file && file.size > 5 * 1024 * 1024) {
                                                            showToast.warn("File too large. HR documents must be under 5MB.");
                                                            e.target.value = '';
                                                            setHrFileObj(null);
                                                        } else {
                                                            setHrFileObj(file || null);
                                                        }
                                                    }} className="text-xs" title="Select HR document to upload" aria-label="Select HR document to upload" />
                                                    <Button type="button" onClick={handleUploadHR} disabled={!hrFileObj || !hrFileLabel || !hrFileType || isUploadingHR} className="text-xs flex items-center gap-1 w-auto">
                                                        <Upload size={12}/> {isUploadingHR ? 'Uploading...' : 'Upload'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="border-t dark:border-slate-700 pt-4 space-y-3">
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                                                <input type="text" placeholder="Search files..." value={hrSearchQuery} onChange={e => setHrSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500" />
                                            </div>
                                            <div className="relative w-32 md:w-48">
                                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                                                <select value={hrTypeFilter} onChange={e => setHrTypeFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 appearance-none" title="Filter HR Files by Type" aria-label="Filter HR Files by Type">
                                                    <option value="All">All Types</option>
                                                    {activeHRCats.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                            {((formData.documents || []).filter(d => 
                                                ( (isSelf && state.currentUser?.role !== 'admin' && state.currentUser?.role !== 'master_admin') ? d.isVisibleToEmployee : true ) &&
                                                (hrTypeFilter === 'All' || d.fileType === hrTypeFilter) &&
                                                (d.label?.toLowerCase().includes(hrSearchQuery.toLowerCase()) || d.description?.toLowerCase().includes(hrSearchQuery.toLowerCase()))
                                            )).map((doc, idx) => (
                                                <div key={`${doc.id}-${idx}`} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center shrink-0">
                                                            <FileText size={18} className="text-slate-500 dark:text-slate-400"/>
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <button type="button" onClick={() => setViewerDoc(doc)} className="font-semibold text-sm text-primary-600 dark:text-primary-400 hover:underline truncate block w-48 md:w-64 text-left">{doc.label}</button>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{doc.fileType || 'Doc'}</span>
                                                                <span className="text-xs text-slate-500 truncate">{doc.description || doc.fileName}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button type="button" onClick={() => setViewerDoc(doc)} className="px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-primary-600 font-medium text-xs">
                                                            View
                                                        </button>
                                                        <a href={doc.dataUrl} download={doc.fileName} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500" title="Download File">
                                                            <Download size={14}/>
                                                        </a>
                                                        {!isSelf && (
                                                            <>
                                                                <button type="button" onClick={() => toggleHRVisibility(doc.id)} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${doc.isVisibleToEmployee ? 'text-emerald-500' : 'text-slate-400'}`} title={doc.isVisibleToEmployee ? "Visible to Employee" : "Hidden from Employee"}>
                                                                    {doc.isVisibleToEmployee ? <Eye size={14}/> : <EyeOff size={14}/>}
                                                                </button>
                                                                <button type="button" onClick={() => handleDeleteHR(doc.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Delete File">
                                                                    <Trash2 size={14}/>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {(!formData.documents || formData.documents.length === 0) && (
                                                <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed dark:border-slate-700">
                                                    <FileText size={24} className="mx-auto text-slate-400 mb-2"/>
                                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No HR Files Found</p>
                                                    <p className="text-xs text-slate-500">Upload documents above to track them.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'security' && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2"><Lock size={16}/> Account Security</h4>
                                    
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg space-y-4">
                                        <div>
                                            <h5 className="font-bold text-sm mb-2 text-slate-700 dark:text-slate-300">Change Password</h5>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Update your account password below. You will be logged out upon completion.</p>
                                            <div className="space-y-3 max-w-sm">
                                                <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                                <Input label="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                                                <Button type="button" disabled={isUpdatingPassword || !newPassword || newPassword !== confirmPassword} onClick={handleChangePassword}>
                                                    {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg space-y-4">
                                        <div>
                                            <h5 className="font-bold text-sm mb-2 text-slate-700 dark:text-slate-300">User Interface Controls</h5>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Restore hidden bubbles or reset widget positions to their defaults.</p>
                                            <Button type="button" variant="secondary" onClick={handleResetOverlays} className="w-auto">
                                                Reset UI Customizations
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-lg space-y-4">
                                        <div>
                                            <h5 className="font-bold text-sm mb-2 text-red-700 dark:text-red-400">Account Recovery</h5>
                                            <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-3">Send a password reset link to your registered email address.</p>
                                            <Button type="button" variant="danger" disabled={isResetting || !formData.email} onClick={handleResetPassword} className="w-auto">
                                                {isResetting ? 'Sending...' : 'Send Password Reset Email'}
                                            </Button>
                                        </div>
                                        {isSelf && (
                                            <div className="pt-4 border-t border-red-200 dark:border-red-800/50">
                                                <h5 className="font-bold text-sm mb-2 text-red-700 dark:text-red-400">Danger Zone: Delete Account</h5>
                                                <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-3">Permanently delete your profile, credentials, and associated data. This cannot be undone.</p>
                                                <Button type="button" variant="danger" disabled={isDeleting} onClick={() => setIsDeleteModalOpen(true)} className="w-auto border-red-700 text-white hover:bg-red-800">
                                                    Delete My Account
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-2 border-t dark:border-gray-700">
                                {!isSelf && formData.id && (
                                    <Button variant="secondary" onClick={handleSendInvite} type="button" className="mr-auto">
                                        <Mail size={16} className="mr-2"/> Send Login Invite
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                                <Button type="submit" disabled={isSaving || isDecrypting}>{isSaving ? 'Saving...' : 'Save Profile'}</Button>
                            </div>
                        </form>
                    </div>
                </div>
            </Modal>

            {viewerDoc && (
                <Modal isOpen={!!viewerDoc} onClose={() => setViewerDoc(null)} title={viewerDoc.label} size="xl">
                    <div className="w-full h-[70vh] flex flex-col bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden relative group">
                        {(() => {
                            const url = viewerDoc.dataUrl || viewerDoc.fileUrl || viewerDoc.url || '';
                            const isImage = url.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(viewerDoc.fileName || '');
                            const isPdf = url.startsWith('data:application/pdf') || /\.(pdf)$/i.test(viewerDoc.fileName || '');
                            
                            if (isImage) {
                                return <img src={url} className="w-full h-full object-contain" alt={viewerDoc.label} />;
                            } else if (isPdf) {
                                return <iframe src={url} className="w-full h-full border-0" title={viewerDoc.label} />;
                            } else if (url.startsWith('http') && /\.(doc|docx|xls|xlsx|csv|ppt|pptx)$/i.test(viewerDoc.fileName || '')) {
                                return <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`} className="w-full h-full border-0" title={viewerDoc.label} />;
                            } else {
                                return (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-800">
                                        <FileText size={48} className="text-slate-400 mb-4" />
                                        <p className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">Preview not available</p>
                                        <p className="text-sm text-slate-500 mb-4">This file type cannot be previewed directly in the browser.</p>
                                        <a href={url} download={viewerDoc.fileName} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                                            <Download size={16} /> Download {viewerDoc.fileName}
                                        </a>
                                    </div>
                                );
                            }
                        })()}
                        
                        {(() => {
                            const url = viewerDoc.dataUrl || viewerDoc.fileUrl || viewerDoc.url || '';
                            const isRenderable = url.startsWith('data:image/') || url.startsWith('data:application/pdf') || /\.(jpg|jpeg|png|gif|webp|heic|pdf)$/i.test(viewerDoc.fileName || '');
                            return isRenderable && (
                                <a href={url} download={viewerDoc.fileName} className="absolute bottom-4 right-4 p-3 bg-slate-900/80 text-white rounded-full shadow-lg hover:bg-black transition-colors opacity-0 group-hover:opacity-100 backdrop-blur-sm" title="Download File">
                                    <Download size={20} />
                                </a>
                            );
                        })()}
                    </div>
                </Modal>
            )}

            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Account Data">
                <div className="space-y-6">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-red-600 font-black">
                            Warning: Irreversible Action
                        </div>
                        <p className="text-sm text-red-800">
                            Selecting this option will permanently delete all of your personal data, profile information, and access credentials from the platform databases. This action cannot be undone. 
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">Keep Account</Button>
                        <Button onClick={handleDeleteAccount} disabled={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700">{isDeleting ? 'Deleting...' : 'Permanently Delete'}</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default EmployeeProfileModal;
