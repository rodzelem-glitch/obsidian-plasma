
import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle'; 
import { useAppContext } from 'context/AppContext';
import { db, auth } from 'lib/firebase';
import type { User } from 'types';
import { User as UserIcon, Lock, Mail, Camera, RefreshCw, CheckCircle, Sparkles, Key, Trash2, DollarSign, Settings } from 'lucide-react';
import { encryptSensitiveData, decryptSensitiveData } from 'lib/encryption';
import { sendEmail } from 'lib/notificationService';

interface EmployeeProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: Partial<User>;
    isSelf?: boolean;
}

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX = 400; 
                if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } } 
                else { if (height > MAX) { width *= MAX / height; height = MAX; } }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
        };
        reader.onerror = reject;
    });
};

const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = reject;
    });
};

const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({ isOpen, onClose, employee: initialData, isSelf = false }) => {
    const { state, dispatch } = useAppContext();
    const [formData, setFormData] = useState<Partial<User>>(initialData);
    const [activeTab, setActiveTab] = useState<'details' | 'roles' | 'permissions' | 'payroll' | 'compliance' | 'security'>('details');
    const [showSensitive, setShowSensitive] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isUploadingPic, setIsUploadingPic] = useState(false);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const [certFile, setCertFile] = useState<File | null>(null);
    const [certName, setCertName] = useState('');
    const [certExpiry, setCertExpiry] = useState('');
    const [isUploadingCert, setIsUploadingCert] = useState(false);

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
        if (!formData.email) { alert("User email is required."); return; }
        setIsResetting(true);
        try { await auth.sendPasswordResetEmail(formData.email); alert(`Reset link sent.`); }
        catch (err: any) { alert("Error: " + err.message); }
        finally { setIsResetting(false); }
    };
    
    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) { alert("Passwords do not match."); return; }
        if (newPassword.length < 6) { alert("Password must be at least 6 characters."); return; }
        setIsUpdatingPassword(true);
        try { await auth.currentUser?.updatePassword(newPassword); alert("Password updated!"); setNewPassword(''); setConfirmPassword(''); }
        catch (err: any) { alert("Error: " + err.message); }
        finally { setIsUpdatingPassword(false); }
    };

    const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingPic(true);
        try {
            const base64 = await compressImage(file);
            setFormData(prev => ({ ...prev, profilePicUrl: base64 }));
        } catch (err) { console.error(err); }
        finally { setIsUploadingPic(false); }
    };
    
    const handleUploadCert = async () => {
        if (!certFile || !certName) return;
        setIsUploadingCert(true);
        try {
            const dataUrl = await compressFile(certFile);
            const newCert = { id: `doc-${Date.now()}`, organizationId: state.currentOrganization?.id || '', fileName: certFile.name, label: certName, dataUrl: dataUrl, createdAt: new Date().toISOString() };
            if (certName === 'I-9 Form' || certName === 'W-4 Form') {
                setFormData(prev => ({ ...prev, documents: [...(prev.documents || []), newCert] }));
            } else {
                setFormData(prev => ({ ...prev, certifications: [...(prev.certifications || []), { name: certName, expiryDate: certExpiry, fileUrl: dataUrl }] }));
            }
            setCertFile(null); setCertName(''); setCertExpiry('');
        } catch (e) { alert("Failed to process file."); }
        finally { setIsUploadingCert(false); }
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
        const inviteLink = `${window.location.origin}/#/register?view=register_user&userType=staff&email=${encodeURIComponent(normalizedEmail)}&name=${encodeURIComponent(fullName)}&oid=${orgId}`;
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
            alert("Invitation email sent!");
        } catch (e) { alert("Failed to send invite."); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!state.currentOrganization) return;
        const isOfflineOnly = formData.hasAppAccess === false;
        const normalizedEmail = (formData.email || '').toLowerCase().trim();
        if (!isOfflineOnly && !normalizedEmail && !formData.id) { alert("Email is required for App Access users."); return; }
        if (isOfflineOnly && (!formData.kioskPin || formData.kioskPin.length !== 4)) { alert("A 4-digit Kiosk PIN is required for Offline employees."); return; }
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
            alert("Error saving profile: " + (error.message || "Unknown Error")); 
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
        ? ['details', 'compliance', 'security'] 
        : ['details', 'roles', 'permissions', 'payroll', 'compliance'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={formData.id ? (isSelf ? "My Profile" : "Edit Employee") : "New Employee"} size="xl">
            <div className="flex flex-col md:flex-row gap-6 h-full max-h-[75vh]">
                <div className="w-full md:w-1/3 flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <div className="relative group">
                        <div className="w-32 h-32 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-5xl text-gray-500 mb-4 overflow-hidden border-4 border-white dark:border-gray-800 shadow-md">
                            {formData.profilePicUrl ? <img src={formData.profilePicUrl} className="w-full h-full object-cover" alt="Profile" /> : <UserIcon size={48} />}
                        </div>
                        <label className="absolute bottom-4 right-0 p-2 bg-primary-600 text-white rounded-full shadow-lg cursor-pointer hover:bg-primary-700 transition-colors">
                            <Camera size={16} /><input type="file" className="hidden" accept="image/*" onChange={handleProfilePicUpload} />
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
                            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize whitespace-nowrap ${activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{tab}</button>
                        ))}
                    </div>
                    <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                        {activeTab === 'details' && (
                            <><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="First Name" value={formData.firstName || ''} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                                <Input label="Last Name" value={formData.lastName || ''} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                            </div>
                            {!isSelf && (
                                <div className="my-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                                    <Toggle 
                                        label="TekTrakker App Access"
                                        description="If disabled, this user cannot login. They exist strictly for Kiosk clock-ins & Payroll (consuming 0 licenses)."
                                        enabled={formData.hasAppAccess !== false} 
                                        onChange={(val) => setFormData({...formData, hasAppAccess: val})} 
                                    />
                                </div>
                            )}
                            {formData.hasAppAccess !== false && (
                                <Input label="Email Address" type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} required={!isSelf} disabled={isSelf} />
                            )}
                            <Input label="Kiosk Access PIN (4 Digits)" type="text" maxLength={4} value={formData.kioskPin || ''} onChange={e => setFormData({...formData, kioskPin: e.target.value.replace(/\D/g, '')})} required={formData.hasAppAccess === false} placeholder="1234" />
                            <Input label="Phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /></>
                        )}
                        
                        {activeTab === 'roles' && !isSelf && (
                            <div className="space-y-6">
                                <Select label="System Role" value={formData.role || 'employee'} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                                    <option value="employee">Technician</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="admin">Admin</option>
                                    <option value="both">Superuser</option>
                                </Select>
                            </div>
                        )}

                        {activeTab === 'permissions' && !isSelf && (
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
                        
                        {activeTab === 'payroll' && !isSelf && (
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
                        
                        {activeTab === 'compliance' && (
                            <div className="space-y-6">
                                <h4 className="font-bold text-sm">Certifications & HR Docs</h4>
                                {formData.certifications?.map((cert, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                                        <div><p className="font-medium text-sm">{cert.name}</p><p className="text-xs text-gray-500">Expires: {cert.expiryDate || 'N/A'}</p></div>
                                        <button type="button" onClick={() => { const c = [...(formData.certifications || [])]; c.splice(i,1); setFormData({...formData, certifications: c}); }} className="text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                                <div className="border-t pt-4">
                                    <Select label="Document Type" value={certName} onChange={e => setCertName(e.target.value)}>
                                        <option value="">-- Select --</option>
                                        <option value="Drivers License">Driver's License</option>
                                        <option value="EPA Card">EPA Certification</option>
                                        <option value="W-4 Form">W-4 Form</option>
                                    </Select>
                                    <input type="file" onChange={e => setCertFile(e.target.files?.[0] || null)} className="mt-2 text-xs" />
                                    <Button type="button" variant="secondary" onClick={handleUploadCert} className="mt-2 text-xs">Upload Doc</Button>
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
    );
};

export default EmployeeProfileModal;
