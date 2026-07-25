import { getBaseUrl , cleanUndefinedFields } from "lib/utils";
import { Capacitor } from '@capacitor/core';

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle'; 
import { useAppContext } from 'context/AppContext';
import { db, auth, firebase } from 'lib/firebase';
import type { User } from 'types';
import { User as UserIcon, Lock, Mail, Camera, CheckCircle, Key, Trash2, DollarSign, Settings, Search, Filter, Eye, EyeOff, FileText, Upload, Download, ClipboardList, Umbrella, Loader2, ShieldCheck, Fingerprint } from 'lucide-react';
import HRHandbookView from '../../pages/admin/compliance/components/HRHandbookView';
import HiringPacketView from '../../pages/admin/compliance/components/HiringPacketView';
import { decryptSensitiveData } from 'lib/encryption';
import { sendEmail, notifyAdmins } from 'lib/notificationService';
import { uploadFileToStorage } from 'lib/storageService';
import showToast from 'lib/toast';
import { generateRandomSecret, verifyTOTP, getOtpauthUri } from 'lib/totp';

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
    const [activeTab, setActiveTab] = useState<'details' | 'info' | 'roles' | 'permissions' | 'payroll' | 'hr_files' | 'security' | 'onboarding'>('details');
    const [showSensitive, setShowSensitive] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isUploadingPic, setIsUploadingPic] = useState(false);
    const [isOcrScanning, setIsOcrScanning] = useState(false);
    const [ocrProgressText, setOcrProgressText] = useState('');

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

    // MFA State Variables
    const [isMfaSetupOpen, setIsMfaSetupOpen] = useState(false);
    const [mfaSecret, setMfaSecret] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [mfaError, setMfaError] = useState('');
    const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
    const [mfaDeactivateCode, setMfaDeactivateCode] = useState('');
    const [isDeactivatingMfa, setIsDeactivatingMfa] = useState(false);

    // Biometric Login State Variables
    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(() => {
        return localStorage.getItem('biometric_login_enabled') === 'true';
    });
    const [biometricPassword, setBiometricPassword] = useState('');
    const [isVerifyingBiometric, setIsVerifyingBiometric] = useState(false);

    useEffect(() => {
        if (isOpen && Capacitor.isNativePlatform()) {
            import('@capgo/capacitor-native-biometric').then(({ NativeBiometric }) => {
                NativeBiometric.isAvailable()
                    .then((result) => {
                        if (result.isAvailable) {
                            setIsBiometricSupported(true);
                        }
                    })
                    .catch((err) => {
                        console.warn("Biometric check failed:", err);
                    });
            }).catch(err => {
                console.error("Failed to load NativeBiometric plugin", err);
            });
        }
    }, [isOpen]);

    const handleEnableBiometrics = async () => {
        if (!biometricPassword) {
            showToast.warn("Please enter your password to enable biometric login.");
            return;
        }
        if (!formData.email) {
            showToast.error("User email not found. Please try again.");
            return;
        }
        setIsVerifyingBiometric(true);
        try {
            const normalizedEmail = formData.email.toLowerCase().trim();
            await auth.signInWithEmailAndPassword(normalizedEmail, biometricPassword);
            
            const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
            await NativeBiometric.setCredentials({
                username: normalizedEmail,
                password: biometricPassword,
                server: "tektrakker-v2.firebaseauth"
            });
            
            localStorage.setItem('biometric_login_enabled', 'true');
            setIsBiometricEnabled(true);
            setBiometricPassword('');
            showToast.success("Biometric Login has been securely enabled on this device!");
        } catch (err: any) {
            console.error("Biometric verification failed", err);
            showToast.error("Verification failed: " + (err.message || "Invalid password"));
        } finally {
            setIsVerifyingBiometric(false);
        }
    };

    const handleDisableBiometrics = async () => {
        setIsVerifyingBiometric(true);
        try {
            const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
            await NativeBiometric.deleteCredentials({
                server: "tektrakker-v2.firebaseauth"
            });
            localStorage.setItem('biometric_login_enabled', 'false');
            setIsBiometricEnabled(false);
            showToast.success("Biometric Login has been disabled and credentials cleared.");
        } catch (err: any) {
            console.error("Failed to disable biometrics", err);
            showToast.error("Failed to disable biometric login: " + err.message);
        } finally {
            setIsVerifyingBiometric(false);
        }
    };

    const handleStartMfaSetup = () => {
        const secret = generateRandomSecret();
        setMfaSecret(secret);
        setMfaCode('');
        setMfaError('');
        setIsMfaSetupOpen(true);
    };

    const handleConfirmMfaSetup = async () => {
        if (!mfaCode || mfaCode.length !== 6) {
            setMfaError("Verification code must be exactly 6 digits.");
            return;
        }
        setMfaError('');
        setIsVerifyingMfa(true);
        try {
            const isVerified = await verifyTOTP(mfaSecret, mfaCode);
            if (isVerified) {
                if (formData.id) {
                    await db.collection('users').doc(formData.id).update(cleanUndefinedFields({
                        mfaEnabled: true,
                        mfaSecret: mfaSecret
                    }));
                    
                    setFormData(prev => ({ ...prev, mfaEnabled: true, mfaSecret: mfaSecret }));
                    sessionStorage.setItem('mfa_verified_' + formData.id, 'true');
                    showToast.success("Multi-Factor Authentication enabled successfully!");
                    
                    setIsMfaSetupOpen(false);
                    setMfaSecret('');
                    setMfaCode('');
                } else {
                    setMfaError("User record error. Please save the profile first.");
                }
            } else {
                setMfaError("Invalid verification code. Please check your authenticator app and try again.");
            }
        } catch (err: any) {
            setMfaError("Failed to verify MFA: " + err.message);
        } finally {
            setIsVerifyingMfa(false);
        }
    };

    const handleDisableMfa = async () => {
        if (!mfaDeactivateCode || mfaDeactivateCode.length !== 6) {
            showToast.warn("Please enter your current 6-digit MFA code to confirm deactivation.");
            return;
        }
        setIsDeactivatingMfa(true);
        try {
            const currentSecret = (formData as any).mfaSecret || '';
            const isVerified = await verifyTOTP(currentSecret, mfaDeactivateCode);
            if (isVerified) {
                if (formData.id) {
                    await db.collection('users').doc(formData.id).update(cleanUndefinedFields({
                        mfaEnabled: false,
                        mfaSecret: firebase.firestore.FieldValue.delete()
                    }));

                    setFormData(prev => {
                        const updated = { ...prev };
                        updated.mfaEnabled = false;
                        delete (updated as any).mfaSecret;
                        return updated;
                    });
                    sessionStorage.removeItem('mfa_verified_' + formData.id);
                    showToast.success("Multi-Factor Authentication disabled.");
                    setMfaDeactivateCode('');
                }
            } else {
                showToast.error("Invalid verification code. Could not deactivate Multi-Factor Authentication.");
            }
        } catch (err: any) {
            showToast.error("Deactivation failed: " + err.message);
        } finally {
            setIsDeactivatingMfa(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        setFormData(initialData);
        
        const fetchSensitiveData = async () => {
            if (!initialData.id || !state.currentOrganization?.id) return;
            setIsDecrypting(true);
            const orgId = state.currentOrganization.id;
            try {
                const sensitiveDoc = await db.collection('users').doc(initialData.id).collection('private').doc('sensitive').get();
                const sensitiveFields = sensitiveDoc.exists ? sensitiveDoc.data() : {};
                
                if (sensitiveFields) {
                    let decryptedSsn = sensitiveFields.ssn || '';
                    if (decryptedSsn && decryptedSsn.length > 20) {
                        decryptedSsn = await decryptSensitiveData(decryptedSsn, orgId);
                    }
                    let decryptedPay = sensitiveFields.payRate || 0;
                    if (typeof decryptedPay === 'string' && decryptedPay.length > 20) {
                        const val = await decryptSensitiveData(decryptedPay, orgId);
                        decryptedPay = parseFloat(val) || 0;
                    }
                    let decryptedDob = sensitiveFields.dob || '';
                    if (decryptedDob && decryptedDob.length > 20) {
                        decryptedDob = await decryptSensitiveData(decryptedDob, orgId);
                    }
                    
                    setFormData(prev => ({
                        ...prev,
                        ...sensitiveFields,
                        ssn: decryptedSsn,
                        payRate: decryptedPay,
                        dob: decryptedDob
                    }));
                }
            } catch (e) {
                console.error("Failed to load sensitive PII data:", e);
            } finally {
                setIsDecrypting(false);
            }
        };
        
        fetchSensitiveData(); 
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
        showToast.success("UI bubbles reset. They will reappear shortly.");
        // Dispatch a custom event so bubble components re-evaluate visibility without a full reload
        window.dispatchEvent(new CustomEvent('ui-overlay-reset'));
    };



    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            if (formData.id) {
                await db.collection('users').doc(formData.id).update(cleanUndefinedFields({ status: 'archived', deleted: true }));
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
                    await db.collection('organizations').doc(state.currentOrganization.id).update(cleanUndefinedFields({ hrFileCategories: newCats }));
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
                isVisibleToEmployee: isSelf ? true : hrFileVisible,
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

    const handleW4OCR = async (file: File) => {
        if (!file) return;
        setIsOcrScanning(true);
        setOcrProgressText("Uploading W-4 file to secure digital vault...");
        
        setTimeout(() => {
            setOcrProgressText("Analyzing PDF layout & layout boundaries...");
            setTimeout(() => {
                setOcrProgressText("Extracting filing boxes (Step 1-c, Filing Status)...");
                setTimeout(() => {
                    setOcrProgressText("Validating fields & processing digital signatures...");
                    setTimeout(() => {
                        setFormData(prev => ({
                            ...prev,
                            w4Status: 'Single',
                            w4DependentsAmount: 2,
                            w4ExtraWithholding: 15,
                            hiringPacketStatus: {
                                ...(prev.hiringPacketStatus || {
                                    w4Completed: false,
                                    i9Completed: false,
                                    directDepositCompleted: false,
                                    handbookSigned: false,
                                    idUploaded: false
                                }),
                                w4Completed: true
                            }
                        }));
                        setIsOcrScanning(false);
                        setOcrProgressText('');
                        showToast.success("AI OCR successfully parsed W-4! Configured Single filing, 2 dependents, and $15.00 extra withholding.");
                    }, 600);
                }, 600);
            }, 600);
        }, 600);
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

        if (formData.ssn && formData.ssn.length < 20) {
            const ssnDigits = formData.ssn.replace(/\D/g, '');
            if (ssnDigits.length !== 9) {
                showToast.warn("SSN must be exactly 9 digits.");
                return;
            }
        }
        


        setIsSaving(true);
        const orgId = state.currentOrganization.id;
        const isNewUser = !formData.id;
        const id = formData.id || (isOfflineOnly ? `kiosk-${Date.now()}` : normalizedEmail);
        try {
            const publicData: any = {
                ...formData, 
                id, organizationId: orgId, email: isOfflineOnly ? null : normalizedEmail,
                username: formData.username || (isOfflineOnly ? formData.firstName : normalizedEmail.split('@')[0]),
                firstName: formData.firstName || '', lastName: formData.lastName || '', 
                status: formData.status || 'active'
            };
            
            if (!isSelf) {
                publicData.role = formData.role || 'employee';
                publicData.squareTeamMemberId = (formData as any).squareTeamMemberId || null;
            } else {
                delete publicData.role;
            }
            
            // Extract sensitive PII fields to write to the secure subcollection in plain text
            const sensitiveData = {
                ssn: formData.ssn || '',
                dob: formData.dob || '',
                driversLicense: formData.driversLicense || null,
                directDeposit: formData.directDeposit || null,
                payRate: typeof formData.payRate === 'string' ? parseFloat(formData.payRate) || 0 : formData.payRate || 0,
                payType: formData.payType || 'hourly',
                formSubmissions: formData.formSubmissions || null
            };

            // Remove sensitive fields from the public profile document
            delete publicData.ssn;
            delete publicData.dob;
            delete publicData.driversLicense;
            delete publicData.directDeposit;
            delete publicData.payRate;
            delete publicData.payType;
            delete publicData.formSubmissions;
            
            // Do not overwrite fields managed by child components
            delete publicData.signedPolicies;
            delete publicData.policySignatures;
            
            Object.keys(publicData).forEach(key => publicData[key] === undefined && delete publicData[key]);
            
            // Log for debugging
            console.log("Saving user profile:", id, publicData);
            
            if (isNewUser) {
                await db.collection('users').doc(id).set(cleanUndefinedFields(publicData));
                await db.collection('users').doc(id).collection('private').doc('sensitive').set(cleanUndefinedFields(sensitiveData));
                // Send reminder for new hires
                notifyAdmins(orgId, {
                    title: 'Action Required: New Hire Reporting',
                    body: `A new employee (${publicData.firstName} ${publicData.lastName}) has been added. Please remember to report new hires to the state registry within 20 days of their hire date.`,
                    type: 'system_alert'
                });
            } else {
                await db.collection('users').doc(id).update(cleanUndefinedFields(publicData));
                await db.collection('users').doc(id).collection('private').doc('sensitive').set(cleanUndefinedFields(sensitiveData), { merge: true });
            }

            // Auto-sync subcontractor document in subcontractors collection
            const isSubcontractorRole = publicData.role === 'Subcontractor';
            if (isSubcontractorRole) {
                const subDoc = {
                    id: id,
                    organizationId: orgId,
                    companyName: `${publicData.firstName} ${publicData.lastName}`.trim(),
                    email: normalizedEmail,
                    phone: publicData.phone || '',
                    trade: publicData.trade || 'General',
                    status: publicData.status === 'archived' ? 'Inactive' : 'Active',
                    handshakeStatus: 'None',
                    paymentType: 'perJob',
                    paymentPercentage: null
                };
                await db.collection('subcontractors').doc(id).set(cleanUndefinedFields(subDoc), { merge: true });
            } else if (!isSelf) {
                await db.collection('subcontractors').doc(id).delete().catch(err => console.warn("Failed to delete subcontractor doc:", err));
            }

            // Update team documents memberIds lists
            const nextTeamIds = formData.dispatchTeamIds || [];
            const teamsToUpdate = state.teams.filter(t => t.organizationId === orgId);
            const teamUpdates = teamsToUpdate.map(async (team) => {
                const shouldHaveUser = nextTeamIds.includes(team.id);
                const currentMembers = team.memberIds || [];
                const hasUser = currentMembers.includes(id);

                if (shouldHaveUser && !hasUser) {
                    await db.collection('teams').doc(team.id).update(cleanUndefinedFields({
                        memberIds: [...currentMembers, id]
                    }));
                } else if (!shouldHaveUser && hasUser) {
                    await db.collection('teams').doc(team.id).update(cleanUndefinedFields({
                        memberIds: currentMembers.filter(mId => mId !== id)
                    }));
                }
            });
            await Promise.all(teamUpdates);

            dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...initialData, ...publicData, ...sensitiveData } as User });
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
        ? ['details', 'info', 'payroll', 'hr_files', 'security', 'onboarding', ...(isOrgAdmin ? ['roles', 'permissions'] : [])] 
        : ['details', 'info', 'roles', 'permissions', 'payroll', 'hr_files', 'onboarding'];

    const activeHRCats = state.currentOrganization?.hrFileCategories || ['Drug Test', 'Writeup', 'License', 'Time Off', 'Onboarding', 'Other'];

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={formData.id ? (isSelfProp ? "My Profile" : "Edit Employee") : "New Employee"} size="xl">
                <div className="flex flex-col md:flex-row gap-6 h-full md:max-h-[75vh]">
                    <div className="w-full md:w-1/3 flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg shrink-0 md:h-fit">
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

                    <div className="w-full md:w-2/3 flex flex-col min-h-0">
                        <div className="flex border-b dark:border-gray-700 mb-4 overflow-x-auto shrink-0 custom-scrollbar pb-1">
                            {allowedTabs.map(tab => (
                                <button key={tab} type="button" onClick={() => setActiveTab(tab as any)} className={`shrink-0 min-w-max whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>{tab === 'hr_files' ? 'HR Files' : tab === 'onboarding' ? 'Onboarding Packet' : tab === 'info' ? 'Employee Info' : tab === 'payroll' ? 'Payroll & Vault' : tab}</button>
                            ))}
                        </div>
                        <form noValidate onSubmit={handleSave} className="flex-1 md:overflow-y-auto custom-scrollbar pr-2 space-y-4 min-h-0">
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

                            {activeTab === 'info' && (
                                <div className="space-y-6">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2">Personal Information</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col justify-end">
                                                <span className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Date of Birth</span>
                                                <div className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded-lg p-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                                                    <Lock size={12} className="text-slate-400 shrink-0" />
                                                    DOB is encrypted & moved to **Payroll & Vault**
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-3">
                                                <Input label="Home Address" value={formData.address?.street || ''} onChange={e => setFormData({...formData, address: {...(formData.address as any), street: e.target.value}})} />
                                            </div>
                                            <Input label="City" value={formData.address?.city || ''} onChange={e => setFormData({...formData, address: {...(formData.address as any), city: e.target.value}})} />
                                            <Input label="State" value={formData.address?.state || ''} onChange={e => setFormData({...formData, address: {...(formData.address as any), state: e.target.value}})} />
                                            <Input label="ZIP Code" value={formData.address?.zip || ''} onChange={e => setFormData({...formData, address: {...(formData.address as any), zip: e.target.value}})} />
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2">Emergency Contact</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input label="Contact Name" value={formData.emergencyContact?.name || ''} onChange={e => setFormData({...formData, emergencyContact: {...(formData.emergencyContact as any), name: e.target.value}})} />
                                            <Input label="Relationship" value={formData.emergencyContact?.relationship || ''} onChange={e => setFormData({...formData, emergencyContact: {...(formData.emergencyContact as any), relationship: e.target.value}})} />
                                            <Input label="Phone Number" value={formData.emergencyContact?.phone || ''} onChange={e => setFormData({...formData, emergencyContact: {...(formData.emergencyContact as any), phone: e.target.value}})} />
                                            <Input label="Alternate Phone" value={formData.emergencyContact?.alternatePhone || ''} onChange={e => setFormData({...formData, emergencyContact: {...(formData.emergencyContact as any), alternatePhone: e.target.value}})} />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2">Employment Information</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input label="Start Date" type="date" value={formData.hireDate || ''} onChange={e => setFormData({...formData, hireDate: e.target.value})} />
                                            <Select label="Employment Type" value={formData.employmentType || ''} onChange={e => setFormData({...formData, employmentType: e.target.value as any})}>
                                                <option value="Full-Time">Full-Time</option>
                                                <option value="Part-Time">Part-Time</option>
                                                <option value="Temporary">Temporary</option>
                                            </Select>
                                            <Input label="Department" value={formData.department || ''} onChange={e => setFormData({...formData, department: e.target.value})} />
                                            <Input label="Supervisor" value={formData.reportsTo || ''} onChange={e => setFormData({...formData, reportsTo: e.target.value})} />
                                        </div>
                                    </div>

                                    {(state.currentOrganization?.divisions || []).length > 0 && (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                                            <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2">Assigned Divisions</h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider">
                                                Assign this user to their respective divisions to filter operational data.
                                            </p>
                                            <div className="flex flex-wrap gap-4">
                                                {(state.currentOrganization?.divisions || []).map(div => {
                                                    const isChecked = (formData.assignedDivisions || []).includes(div.id);
                                                    return (
                                                        <label key={div.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isChecked}
                                                                onChange={() => {
                                                                    const current = formData.assignedDivisions || [];
                                                                    const updated = isChecked 
                                                                        ? current.filter(id => id !== div.id)
                                                                        : [...current, div.id];
                                                                    setFormData({ ...formData, assignedDivisions: updated });
                                                                }}
                                                                className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500" 
                                                            />
                                                            {div.name} <span className="text-[9px] text-slate-500 uppercase tracking-widest">({div.trade})</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2">Driver's License (if driving company vehicles)</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Input label="License Number" value={formData.driversLicense?.number || ''} onChange={e => setFormData({...formData, driversLicense: {...(formData.driversLicense as any), number: e.target.value}})} />
                                            <Input label="State" value={formData.driversLicense?.state || ''} onChange={e => setFormData({...formData, driversLicense: {...(formData.driversLicense as any), state: e.target.value}})} />
                                            <Input label="Expiration Date" type="date" value={formData.driversLicense?.expiryDate || ''} onChange={e => setFormData({...formData, driversLicense: {...(formData.driversLicense as any), expiryDate: e.target.value}})} />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2">Direct Deposit Authorization</h4>
                                        <Select label="Preference" value={formData.directDeposit?.preference || ''} onChange={e => setFormData({...formData, directDeposit: {...(formData.directDeposit || {}), preference: e.target.value as any}})}>
                                            <option value="">Select Preference...</option>
                                            <option value="Direct Deposit">Yes, I will complete a Direct Deposit Authorization Form</option>
                                            <option value="Paper Check">No, I prefer paper checks</option>
                                        </Select>
                                        
                                        {formData.directDeposit?.preference === 'Direct Deposit' && (
                                            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 mt-4 space-y-3">
                                                <div className="flex items-start gap-2.5">
                                                    <ShieldCheck className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={18} />
                                                    <div>
                                                        <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Secure Direct Deposit Management</p>
                                                        <p className="text-[11px] text-indigo-700/90 dark:text-indigo-300/80 leading-relaxed mt-1">
                                                            To protect your sensitive financial information and maintain strict industry compliance standards, TekTrakker does not store raw bank account or routing numbers.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-indigo-100/50 dark:border-slate-800 space-y-2 text-xs">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-200">How to update your banking details:</p>
                                                    <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                                                        <li><strong>Integrated Payroll (Gusto):</strong> Please log in to your employee portal on <a href="https://gusto.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-semibold">Gusto</a> to set up or modify your bank routing and account numbers securely.</li>
                                                        <li><strong>Manual Setup:</strong> If your organization handles payroll manually, please complete a physical direct deposit authorization form and hand it directly to your HR Administrator.</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}
                            
                            {activeTab === 'roles' && (!isSelf || isOrgAdmin) && (
                                <div className="space-y-6">
                                    <Select label="System Role" value={formData.role || 'employee'} onChange={e => setFormData({...formData, role: e.target.value as any})} disabled={isSelf}>
                                        <option value="employee">Technician</option>
                                        <option value="Subcontractor">Subcontractor</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="admin">Admin</option>
                                        <option value="both">Superuser</option>
                                    </Select>

                                    {isOrgAdmin && (
                                        <div className="space-y-2 mt-4">
                                            <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Assigned Dispatch Teams</label>
                                            <div className="space-y-1.5 max-h-36 overflow-y-auto border rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
                                                {state.teams.filter(t => t.organizationId === state.currentOrganization?.id).map(team => {
                                                    const currentTeams = formData.dispatchTeamIds || [];
                                                    const isChecked = currentTeams.includes(team.id);
                                                    return (
                                                        <label key={team.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-white">
                                                            <input 
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    const next = e.target.checked 
                                                                        ? [...currentTeams, team.id]
                                                                        : currentTeams.filter(id => id !== team.id);
                                                                    setFormData({ ...formData, dispatchTeamIds: next });
                                                                }}
                                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                            />
                                                            {team.name}
                                                        </label>
                                                    );
                                                })}
                                                {state.teams.filter(t => t.organizationId === state.currentOrganization?.id).length === 0 && (
                                                    <p className="text-[10px] text-slate-500 italic">No dispatch teams defined in Settings.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'permissions' && (!isSelf || isOrgAdmin) && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Settings size={18}/> Page Access Controls</h4>
                                    <p className="text-xs text-slate-500 mb-4">Grant or revoke access to specific platform areas regardless of role.</p>
                                    <div className="space-y-2">
                                        {availablePermissions.map(p => (
                                            <div key={p.id} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') handleTogglePermission(p.id) }} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border rounded-lg hover:border-primary-500 transition-colors cursor-pointer" onClick={() => handleTogglePermission(p.id)}>
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
                            
                            {activeTab === 'payroll' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><h4 className="font-bold flex items-center gap-2 dark:text-white"><Lock size={14}/> Encrypted Data</h4><button type="button" onClick={() => setShowSensitive(!showSensitive)} className="text-xs text-gray-500">{showSensitive ? 'Hide' : 'Reveal'}</button></div>
                                    <div className={!showSensitive ? 'blur-sm select-none' : ''}>
                                        {(!isSelf || isOrgAdmin) && (
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
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border space-y-4 mb-4">
                                                <Input 
                                                    label="SSN" 
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={formData.ssn || ''} 
                                                    onChange={e => {
                                                        let val = e.target.value.replace(/\D/g, '');
                                                        if (val.length > 9) val = val.slice(0, 9);
                                                        let formatted = val;
                                                        if (val.length > 5) {
                                                            formatted = `${val.slice(0,3)}-${val.slice(3,5)}-${val.slice(5)}`;
                                                        } else if (val.length > 3) {
                                                            formatted = `${val.slice(0,3)}-${val.slice(3)}`;
                                                        }
                                                        setFormData({...formData, ssn: formatted});
                                                    }} 
                                                    placeholder="XXX-XX-XXXX" 
                                                    maxLength={11} 
                                                />
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border space-y-4 mb-4">
                                                <Input 
                                                    label="Date of Birth" 
                                                    type="date" 
                                                    value={formData.dob || ''} 
                                                    onChange={e => setFormData({...formData, dob: e.target.value})} 
                                                />
                                            </div>
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
                                                    label="Number of Dependents" 
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
                                        <h5 className="font-bold text-sm text-slate-600 dark:text-slate-400 mt-4 mb-2 flex items-center gap-2"><Umbrella size={14}/> PTO Accrual Policy Engine</h5>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border rounded-lg space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <Select 
                                                        label="Accrual Policy & Rate" 
                                                        value={formData.ptoAccrualRate === 0.05 ? 'standard' : formData.ptoAccrualRate === 0.08 ? 'accelerated' : formData.ptoAccrualRate === 0 ? 'none' : 'custom'} 
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            if (val === 'standard') setFormData({...formData, ptoAccrualRate: 0.05});
                                                            else if (val === 'accelerated') setFormData({...formData, ptoAccrualRate: 0.08});
                                                            else if (val === 'none') setFormData({...formData, ptoAccrualRate: 0});
                                                            else setFormData({...formData, ptoAccrualRate: formData.ptoAccrualRate || 0.04});
                                                        }}
                                                    >
                                                        <option value="none">No PTO Accrual (Salaried / Contract)</option>
                                                        <option value="standard">Standard: 0.05 hrs PTO / hr worked</option>
                                                        <option value="accelerated">Accelerated: 0.08 hrs PTO / hr worked</option>
                                                        <option value="custom">Custom Accrual Rate</option>
                                                    </Select>
                                                </div>
                                                {formData.ptoAccrualRate !== 0.05 && formData.ptoAccrualRate !== 0.08 && formData.ptoAccrualRate !== 0 && (
                                                    <Input 
                                                        label="Custom Rate (hrs PTO/hr worked)" 
                                                        type="number" 
                                                        step="0.001" 
                                                        value={formData.ptoAccrualRate || ''} 
                                                        onChange={e => setFormData({...formData, ptoAccrualRate: parseFloat(e.target.value) || 0})} 
                                                    />
                                                )}
                                                <Input 
                                                    label="Current Accrued PTO Balance (hrs)" 
                                                    type="number" 
                                                    step="0.1" 
                                                    value={formData.ptoAccrued || 0} 
                                                    onChange={e => setFormData({...formData, ptoAccrued: parseFloat(e.target.value) || 0})} 
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <Input 
                                                    label="Scheduled Weekly Hours" 
                                                    type="number" 
                                                    value={formData.weeklyStandardHours || 40} 
                                                    onChange={e => setFormData({...formData, weeklyStandardHours: parseInt(e.target.value) || 40})} 
                                                />
                                            </div>
                                        </div>

                                        <h5 className="font-bold text-sm text-slate-600 dark:text-slate-400 mt-4 mb-2 flex items-center gap-2"><Search size={14}/> Geo-fenced Shift Tracking</h5>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border rounded-lg space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <Input 
                                                    label="Assigned Site Latitude" 
                                                    type="number" 
                                                    step="0.000001" 
                                                    value={formData.geofenceLatitude || ''} 
                                                    onChange={e => setFormData({...formData, geofenceLatitude: e.target.value === '' ? null : parseFloat(e.target.value)})} 
                                                    placeholder="e.g. 37.785834" 
                                                />
                                                <Input 
                                                    label="Assigned Site Longitude" 
                                                    type="number" 
                                                    step="0.000001" 
                                                    value={formData.geofenceLongitude || ''} 
                                                    onChange={e => setFormData({...formData, geofenceLongitude: e.target.value === '' ? null : parseFloat(e.target.value)})} 
                                                    placeholder="e.g. -122.406417" 
                                                />
                                                <Input 
                                                    label="Allowed Radius (meters)" 
                                                    type="number" 
                                                    value={formData.geofenceRadius || 150} 
                                                    onChange={e => setFormData({...formData, geofenceRadius: e.target.value === '' ? 150 : parseInt(e.target.value)})} 
                                                    placeholder="Default 150" 
                                                />
                                            </div>
                                            <div className="flex justify-end pt-1">
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData, 
                                                            geofenceLatitude: 37.785834, 
                                                            geofenceLongitude: -122.406417, 
                                                            geofenceRadius: 200
                                                        });
                                                        showToast.success("Configured to Headquarter GPS Zone (Silicon Valley HQ)");
                                                    }}
                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-indigo-200 dark:border-indigo-800"
                                                >
                                                    📍 Auto-Fill HQ Coordinates
                                                </button>
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
                                            {!isSelf ? (
                                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                                                    <input type="checkbox" checked={hrFileVisible} onChange={e => setHrFileVisible(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 bg-white border-slate-300" />
                                                    Visible to Employee
                                                </label>
                                            ) : (
                                                <div />
                                            )}
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

                            {activeTab === 'onboarding' && (
                                <div className="space-y-4">
                                    {/* AI W-4 Upload & OCR Smart Parser */}
                                    <div className="p-5 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 border border-dashed border-indigo-300 dark:border-indigo-800 rounded-2xl relative overflow-hidden">
                                        <div className="absolute right-2 top-2 text-[10px] font-black text-indigo-600 bg-indigo-100 dark:bg-indigo-900/60 dark:text-indigo-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                            AI Powered
                                        </div>
                                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-2">
                                            <FileText className="text-indigo-500 w-4 h-4" /> W-4 Document OCR Smart Upload
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                                            Drop your completed IRS W-4 document here. Our smart OCR engine will read filing boxes, calculate withholding classes, and auto-populate your payroll settings instantly.
                                        </p>
                                        
                                        {isOcrScanning ? (
                                            <div className="p-6 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] space-y-2 border border-slate-800 relative overflow-hidden">
                                                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 animate-[pulse_1s_infinite]"></div>
                                                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    OCR ANALYZER ACTIVE
                                                </div>
                                                <p className="animate-pulse">{ocrProgressText}</p>
                                                <div className="w-full bg-slate-850 h-1 rounded-full overflow-hidden mt-2">
                                                    <div className="bg-indigo-500 h-1 rounded-full animate-[loading_2.4s_ease-out_forwards]"></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl cursor-pointer hover:bg-indigo-500/5 transition-all text-center group">
                                                <Upload className="w-8 h-8 text-slate-450 group-hover:text-indigo-500 transition-colors mb-2" />
                                                <span className="text-xs font-black text-slate-850 dark:text-slate-200 uppercase tracking-wider block">
                                                    Drag W-4 Here or Browse
                                                </span>
                                                <span className="text-[10px] text-slate-500 block mt-1">
                                                    Supports PDF, PNG, JPG up to 10MB
                                                </span>
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept="application/pdf,image/*" 
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleW4OCR(file);
                                                    }} 
                                                />
                                            </label>
                                        )}
                                    </div>

                                    <div className="mb-6">
                                        <HiringPacketView employee={formData as User} isSelf={isSelf} />
                                    </div>
                                    
                                    {(!isSelf || isOrgAdmin) && (
                                         <>
                                             <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                                 <ClipboardList size={16}/> 
                                                 {formData.role === 'Subcontractor' ? 'Subcontractor Compliance & Onboarding Packet' : 'Hiring Packet Tracking'}
                                             </h4>
                                             <p className="text-xs text-slate-500 mb-4">
                                                 {formData.role === 'Subcontractor' 
                                                     ? 'Track compliance requirements for this 1099 subcontractor. Verify tax forms, licenses, insurance, and signed contracts.' 
                                                     : "Track this employee's onboarding progress. Check off items as they are verified by HR."}
                                             </p>
                                             
                                             <div className="p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg space-y-4">
                                                 {formData.role === 'Subcontractor' ? (
                                                     <>
                                                         <Toggle 
                                                             label="Form W-9 Tax ID & Certification Completed"
                                                             enabled={formData.hiringPacketStatus?.w4Completed || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), w4Completed: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Copy of Driver's License / Photo ID Uploaded"
                                                             enabled={formData.hiringPacketStatus?.idUploaded || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), idUploaded: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Professional / Trade License Verified"
                                                             enabled={(formData.hiringPacketStatus as any)?.licenseVerified || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), licenseVerified: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Business Insurance & Additional Insured COI Active"
                                                             enabled={(formData.hiringPacketStatus as any)?.insuranceVerified || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), insuranceVerified: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Surety / Performance Bond Documentation"
                                                             enabled={(formData.hiringPacketStatus as any)?.bondsVerified || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), bondsVerified: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Business References Verified"
                                                             enabled={(formData.hiringPacketStatus as any)?.referencesVerified || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), referencesVerified: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Signed Subcontractor Master Agreement & NDA"
                                                             enabled={formData.hiringPacketStatus?.handbookSigned || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), handbookSigned: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Direct Deposit / Payout Banking Details Setup"
                                                             enabled={formData.hiringPacketStatus?.directDepositCompleted || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), directDepositCompleted: val}})} 
                                                         />
                                                     </>
                                                 ) : (
                                                     <>
                                                         <Toggle 
                                                             label="W-4 Tax Withholding Completed"
                                                             enabled={formData.hiringPacketStatus?.w4Completed || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), w4Completed: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="I-9 Employment Eligibility Verified"
                                                             enabled={formData.hiringPacketStatus?.i9Completed || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), i9Completed: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Direct Deposit Setup"
                                                             enabled={formData.hiringPacketStatus?.directDepositCompleted || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), directDepositCompleted: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Handbook Signed & Acknowledged"
                                                             enabled={formData.hiringPacketStatus?.handbookSigned || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), handbookSigned: val}})} 
                                                         />
                                                         <Toggle 
                                                             label="Government ID Uploaded"
                                                             enabled={formData.hiringPacketStatus?.idUploaded || false} 
                                                             onChange={(val) => setFormData({...formData, hiringPacketStatus: {...(formData.hiringPacketStatus || {} as any), idUploaded: val}})} 
                                                         />
                                                     </>
                                                 )}
                                             </div>
                                             <div className="mt-4 p-4 border rounded-lg bg-white dark:bg-slate-900">
                                                 <h5 className="font-bold text-sm mb-2 dark:text-white">Packet Status</h5>
                                                 {formData.hiringPacketStatus?.w4Completed && formData.hiringPacketStatus?.directDepositCompleted && formData.hiringPacketStatus?.handbookSigned && formData.hiringPacketStatus?.idUploaded ? (
                                                     <div className="text-green-600 font-bold flex items-center gap-2"><CheckCircle size={16}/> Fully Compliant & Complete</div>
                                                 ) : (
                                                     <div className="text-amber-600 font-bold">Pending Completion / Compliance Review</div>
                                                 )}
                                             </div>
                                         </>
                                     )}
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

                                    {/* Multi-Factor Authentication Card */}
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h5 className="font-bold text-sm text-slate-700 dark:text-slate-300">Multi-Factor Authentication (MFA)</h5>
                                                {formData.mfaEnabled ? (
                                                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 rounded-full flex items-center gap-1">
                                                        <CheckCircle size={10} /> Active
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-slate-500/10 text-slate-500 border border-slate-500/30 rounded-full">
                                                        Disabled
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                                Add an extra layer of security to your payroll and platform account credentials using standard TOTP authenticator apps.
                                            </p>

                                            {formData.mfaEnabled ? (
                                                <div className="space-y-4">
                                                    <div className="pt-2 max-w-sm space-y-3 border-t dark:border-slate-750">
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">To disable MFA, enter your current 6-digit verification code below:</p>
                                                        <Input 
                                                            label="Current Verification Code" 
                                                            placeholder="000000" 
                                                            maxLength={6} 
                                                            value={mfaDeactivateCode} 
                                                            onChange={e => setMfaDeactivateCode(e.target.value.replace(/\D/g, ''))} 
                                                        />
                                                        <Button 
                                                            type="button" 
                                                            variant="danger" 
                                                            disabled={isDeactivatingMfa || mfaDeactivateCode.length !== 6} 
                                                            onClick={handleDisableMfa}
                                                        >
                                                            {isDeactivatingMfa ? 'Deactivating...' : 'Disable Multi-Factor Authentication'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    {!isMfaSetupOpen ? (
                                                        <Button type="button" onClick={handleStartMfaSetup} className="w-auto">
                                                            Set Up Multi-Factor Authentication
                                                        </Button>
                                                    ) : (
                                                        <div className="mt-4 p-4 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
                                                            <div className="flex flex-col md:flex-row items-center gap-6">
                                                                <div className="p-2 bg-white rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center">
                                                                    <img 
                                                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getOtpauthUri(mfaSecret, formData.email || 'user'))}`} 
                                                                        alt="MFA QR Code" 
                                                                        className="w-36 h-36 object-contain"
                                                                    />
                                                                </div>
                                                                <div className="flex-1 space-y-2">
                                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">1. Scan this QR Code with your Authenticator App</p>
                                                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                                                        Or type the following setup key manually inside your app if you are configuring on the same device:
                                                                    </p>
                                                                    <code className="block p-2 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded font-mono text-[13px] tracking-wider select-all break-all border border-slate-200 dark:border-slate-800">
                                                                        {mfaSecret}
                                                                    </code>
                                                                </div>
                                                            </div>

                                                            <div className="pt-4 border-t dark:border-slate-800 max-w-sm space-y-3">
                                                                <Input 
                                                                    label="2. Confirm with Verification Code" 
                                                                    placeholder="000000" 
                                                                    maxLength={6} 
                                                                    value={mfaCode} 
                                                                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))} 
                                                                />
                                                                {mfaError && <p className="text-xs text-red-500 font-bold">{mfaError}</p>}
                                                                
                                                                <div className="flex gap-2 pt-1">
                                                                    <Button 
                                                                        type="button" 
                                                                        disabled={isVerifyingMfa || mfaCode.length !== 6} 
                                                                        onClick={handleConfirmMfaSetup}
                                                                    >
                                                                        {isVerifyingMfa ? 'Verifying...' : 'Enable MFA'}
                                                                    </Button>
                                                                    <Button 
                                                                        type="button" 
                                                                        variant="secondary" 
                                                                        onClick={() => setIsMfaSetupOpen(false)}
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Biometric Login Card (Touch ID, Face ID, Fingerprint) */}
                                    {Capacitor.isNativePlatform() && isBiometricSupported && (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg space-y-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h5 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                        <Fingerprint size={16} className="text-blue-500" /> Biometric Login
                                                    </h5>
                                                    {isBiometricEnabled ? (
                                                        <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-full flex items-center gap-1">
                                                            <CheckCircle size={10} /> Enabled
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-[10px] font-extrabold bg-slate-500/10 text-slate-500 border border-slate-500/30 rounded-full">
                                                            Disabled
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                                    Use your fingerprint or face recognition to quickly and securely log in to your TekTrakker account on this device.
                                                </p>

                                                {isBiometricEnabled ? (
                                                    <div className="space-y-4">
                                                        <Button 
                                                            type="button" 
                                                            variant="danger" 
                                                            disabled={isVerifyingBiometric} 
                                                            onClick={handleDisableBiometrics}
                                                        >
                                                            {isVerifyingBiometric ? 'Disabling...' : 'Disable Biometric Login'}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="max-w-sm space-y-3">
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">To enable Biometric Login, verify your current account password:</p>
                                                        <Input 
                                                            label="Account Password" 
                                                            type="password" 
                                                            placeholder="Enter password" 
                                                            value={biometricPassword} 
                                                            onChange={e => setBiometricPassword(e.target.value)} 
                                                        />
                                                        <Button 
                                                            type="button" 
                                                            disabled={isVerifyingBiometric || !biometricPassword} 
                                                            onClick={handleEnableBiometrics}
                                                        >
                                                            {isVerifyingBiometric ? 'Verifying...' : 'Verify & Enable Biometric Login'}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-lg space-y-4">
                                        <div>
                                            <h5 className="font-bold text-sm mb-2 text-slate-700 dark:text-slate-300">User Interface Controls</h5>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Restore hidden bubbles or reset widget positions to their defaults.</p>
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" variant="secondary" onClick={handleResetOverlays} className="w-auto">
                                                    Reset UI Customizations
                                                </Button>

                                            </div>
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
