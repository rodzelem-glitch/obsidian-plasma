
import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { useAppContext } from 'context/AppContext';
import { db } from 'lib/firebase';
import type { Customer, EquipmentAsset, ServiceAgreement, MembershipPlan, Job, StoredFile } from 'types';
import { MapPinIcon, TrashIcon, PlusCircle, Wrench, FileText, DollarSign, Image, User, Mail, QrCode, Printer, Sparkles, ShieldCheck, Ban, MessageSquare, CheckCircle, Edit } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { globalConfirm } from "lib/globalConfirm";
import { sendEmail } from 'lib/notificationService';

interface CustomerMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
}

const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (file.type.startsWith('image/')) {
                const img = new window.Image();
                img.src = result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX = 800; 
                    if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } } 
                    else { if (height > MAX) { width *= MAX / height; height = MAX; } }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.5)); 
                };
            } else {
                resolve(result);
            }
        };
        reader.onerror = reject;
    });
};

const CustomerMasterModal: React.FC<CustomerMasterModalProps> = ({ isOpen, onClose, customerId }) => {
    const { state, dispatch } = useAppContext();
    const customer = state.customers.find(c => c.id === customerId);
    
    const [activeTab, setActiveTab] = useState<'overview' | 'equipment' | 'history' | 'financials' | 'docs'>('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Customer>>({});
    const [isSendingInvite, setIsSendingInvite] = useState(false);
    
    // Equipment State
    const [newEquipment, setNewEquipment] = useState<EquipmentAsset>({ id: '', brand: '', model: '', serial: '', type: 'Split System' });
    const [isAddingEquip, setIsAddingEquip] = useState(false);
    const [isSavingAsset, setIsSavingAsset] = useState(false); // Fix for duplicates

    // Membership Manual Enrollment State
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [enrollSystemCount, setEnrollSystemCount] = useState(1);
    const [isProcessingEnrollment, setIsProcessingEnrollment] = useState(false);

    // Modal States
    const [viewQrAsset, setViewQrAsset] = useState<EquipmentAsset | null>(null);
    const [viewingFile, setViewingFile] = useState<StoredFile | null>(null);

    // Derived Data
    const customerJobs = useMemo(() => state.jobs.filter(j => j.customerId === customerId).sort((a,b) => new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime()), [customerId, state.jobs]);
    const invoices = customerJobs.filter(j => j.invoice).map(j => ({ ...j.invoice, jobDate: j.appointmentTime }));
    const membership = state.serviceAgreements.find(sa => sa.customerId === customerId && sa.status === 'Active');
    
    // Aggregate Files (Customer + Jobs)
    const allFiles = useMemo(() => {
        const files: StoredFile[] = [];
        if (customer?.files) files.push(...customer.files);
        customerJobs.forEach(j => {
            if (j.files) files.push(...j.files);
        });
        return files.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [customer, customerJobs]);

    if (!customer) return null;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            const dataUrl = await compressFile(file);
            const newFile: StoredFile = {
                id: `file-${Date.now()}`,
                organizationId: state.currentOrganization?.id || '',
                parentId: customer.id,
                parentType: 'customer',
                fileName: file.name,
                fileType: file.type,
                dataUrl: dataUrl,
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser?.id || 'admin'
            };
            
            const updatedFiles = [...(customer.files || []), newFile];
            await db.collection('customers').doc(customer.id).update({ files: updatedFiles });
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, files: updatedFiles } });
        } catch (err) {
            console.error(err);
            alert("Upload failed.");
        }
    };

    const handleDeleteCustomer = async () => {
        if (!await globalConfirm(`PERMANENTLY DELETE ${customer.name}? All history and files will be inaccessible.`)) return;
        try {
            await db.collection('customers').doc(customer.id).delete();
            dispatch({ type: 'DELETE_CUSTOMER', payload: customer.id });
            onClose();
        } catch (e) {
            console.error(e);
            alert("Delete failed. Please ensure you have permissions.");
        }
    };

    const handleSaveOverview = async () => {
        const updated = { ...customer, ...formData };
        await db.collection('customers').doc(customer.id).update(updated);
        dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
        setIsEditing(false);
    };

    const handleAddEquipment = async () => {
        if (isSavingAsset) return;
        setIsSavingAsset(true);

        try {
            let updatedEquipment;
            // Check if we are updating an existing asset
            if (newEquipment.id) {
                updatedEquipment = (customer.equipment || []).map(e => 
                    e.id === newEquipment.id ? newEquipment : e
                );
            } else {
                // Creating new asset
                const asset: EquipmentAsset = { ...newEquipment, id: `eq-${Date.now()}` };
                updatedEquipment = [...(customer.equipment || []), asset];
            }

            const updatedCustomer = { ...customer, equipment: updatedEquipment };
            
            await db.collection('customers').doc(customer.id).update({ equipment: updatedEquipment });
            dispatch({ type: 'UPDATE_CUSTOMER', payload: updatedCustomer });
            setIsAddingEquip(false);
            setNewEquipment({ id: '', brand: '', model: '', serial: '', type: 'Split System' });
        } catch (e) {
            console.error(e);
            alert("Failed to save asset.");
        } finally {
            setIsSavingAsset(false);
        }
    };

    const handleEditEquipment = (asset: EquipmentAsset) => {
        setNewEquipment(asset);
        setIsAddingEquip(true);
    };

    const handleDeleteEquipment = async (assetId: string) => {
        if (!await globalConfirm("Are you sure you want to delete this asset?")) return;
        const updatedEquipment = (customer.equipment || []).filter(e => e.id !== assetId);
        await db.collection('customers').doc(customer.id).update({ equipment: updatedEquipment });
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: updatedEquipment } });
    };

    const handleManualEnroll = async (plan: MembershipPlan) => {
        if (!state.currentOrganization || isProcessingEnrollment) return;
        setIsProcessingEnrollment(true);
        
        const orgId = state.currentOrganization.id;
        const agreementId = `sa-man-${Date.now()}`;
        
        // Calculate Price based on System Count
        const basePrice = plan.monthlyPrice;
        const extraCost = plan.pricePerAdditionalSystem || 0;
        const finalPrice = basePrice + ((Math.max(1, enrollSystemCount) - 1) * extraCost);

        const newAgreement: ServiceAgreement = {
            id: agreementId,
            organizationId: orgId,
            customerId: customer.id,
            customerName: customer.name,
            planName: plan.name,
            price: finalPrice,
            billingCycle: 'Monthly',
            startDate: new Date().toISOString(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
            status: 'Active',
            visitsTotal: plan.visitsPerYear,
            visitsRemaining: plan.visitsPerYear,
            termsAccepted: true,
            termsSignedDate: new Date().toISOString(),
            termsSignature: `Staff: ${state.currentUser?.firstName}`,
            systemCount: enrollSystemCount
        };

        const firstInvoiceJob: Job = {
            id: `job-mem-start-${Date.now()}`,
            organizationId: orgId,
            customerName: customer.name,
            customerId: customer.id,
            address: customer.address,
            tasks: [`Enrollment: ${plan.name}`],
            jobStatus: 'Completed',
            appointmentTime: new Date().toISOString(),
            source: 'ManualStaff',
            specialInstructions: '',
            invoice: {
                id: `INV-MEM-${Date.now()}`,
                status: 'Unpaid',
                items: [{
                    id: 'it-1',
                    description: `Join ${plan.name} Membership (${enrollSystemCount} Systems)`,
                    quantity: 1,
                    unitPrice: finalPrice,
                    total: finalPrice,
                    type: 'Fee'
                }],
                subtotal: finalPrice,
                taxRate: 0,
                taxAmount: 0,
                totalAmount: finalPrice,
                amount: finalPrice
            },
            jobEvents: [],
            createdAt: new Date().toISOString()
        };

        try {
            await Promise.all([
                db.collection('serviceAgreements').doc(agreementId).set(newAgreement),
                db.collection('jobs').doc(firstInvoiceJob.id).set(firstInvoiceJob)
            ]);
            setIsEnrolling(false);
            setEnrollSystemCount(1);
            alert(`Customer enrolled in ${plan.name} for ${enrollSystemCount} systems. Initial invoice created.`);
        } catch (e) {
            console.error(e);
            alert("Enrollment failed.");
        } finally {
            setIsProcessingEnrollment(false);
        }
    };

    const handleCancelMembership = async () => {
        if (!membership) return;
        if (!await globalConfirm("Are you sure you want to cancel this membership? This will stop recurring billing if configured.")) return;

        try {
            await db.collection('serviceAgreements').doc(membership.id).update({
                status: 'Cancelled',
                endDate: new Date().toISOString() // End immediately
            });
            alert("Membership cancelled.");
        } catch (e) {
            console.error(e);
            alert("Failed to cancel membership.");
        }
    };

    const handleSendInvite = async () => {
        if (!customer.email) {
            alert("Customer record missing email address.");
            return;
        }
        
        setIsSendingInvite(true);
        const org = state.currentOrganization;
        const orgName = org?.name || 'Service Provider';
        const normalizedEmail = customer.email.trim().toLowerCase();
        const portalLink = `${window.location.origin}/#/register?view=register_user&userType=customer&email=${encodeURIComponent(normalizedEmail)}&name=${encodeURIComponent(customer.name)}&oid=${customer.organizationId}`;
        const smtp = org?.smtpConfig;

        try {
            // 1. Create a root user document (Acts as an INVITE for registration)
            const inviteDoc: any = {
                email: normalizedEmail,
                organizationId: org?.id || 'unaffiliated',
                role: 'customer',
                status: 'invited',
                firstName: customer.firstName || customer.name.split(' ')[0],
                lastName: customer.lastName || customer.name.split(' ').slice(1).join(' ') || '',
                phone: customer.phone || '',
                address: {
                    street: customer.address || '',
                    city: customer.city || '',
                    state: customer.state || '',
                    zip: customer.zip || ''
                },
                createdAt: new Date().toISOString(),
                preferences: { theme: 'dark' }
            };

            await db.collection('users').doc(normalizedEmail).set(inviteDoc, { merge: true });
            
            // 2. Prepare Email Payload
            const mailPayload = {
                to: [normalizedEmail],
                message: {
                    subject: `Portal Invitation: ${orgName}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #2563eb;">Welcome to the ${orgName} Customer Portal</h2>
                            <p>Hi ${customer.firstName || customer.name},</p>
                            <p>We've created a secure portal for you to view your service history, upcoming appointments, and invoices.</p>
                            <p style="margin: 30px 0;">
                                <a href="${portalLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Setup Your Account</a>
                            </p>
                            <p style="font-size: 12px; color: #666;">If the button above doesn't work, copy and paste this link into your browser:<br/>
                            <a href="${portalLink}">${portalLink}</a></p>
                            <p>Please use this email address to register: <strong>${normalizedEmail}</strong></p>
                            <br/>
                            <p>Thanks,<br/>${orgName}</p>
                        </div>
                    `,
                    text: `Welcome to the ${orgName} Portal. Setup your account here: ${portalLink}`,
                    replyTo: org?.email,
                },
                type: 'PortalInvite'
            };

            await sendEmail(org, mailPayload);
            alert(`Invitation sent to ${normalizedEmail}`);
        } catch (error) {
            console.error(error);
            alert("Failed to send invitation.");
        } finally {
            setIsSendingInvite(false);
        }
    };

    const handlePrintQr = () => {
        const printWindow = window.open('', '_blank');
        const qrCanvas = document.getElementById('asset-qr-canvas') as HTMLCanvasElement;
        
        if (printWindow && qrCanvas && viewQrAsset) {
            const qrDataUrl = qrCanvas.toDataURL('image/png');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Asset Tag - ${viewQrAsset.brand}</title>
                        <style>
                            body { font-family: sans-serif; text-align: center; padding: 20px; }
                            .tag { border: 2px solid black; padding: 20px; display: inline-block; border-radius: 10px; }
                            img { width: 200px; height: 200px; }
                            h2 { margin: 10px 0 5px; }
                            p { margin: 0; color: #555; }
                        </style>
                    </head>
                    <body>
                        <div class="tag">
                            <h2>Asset Tag</h2>
                            <img src="${qrDataUrl}" />
                            <h3>${viewQrAsset.brand} ${viewQrAsset.type}</h3>
                            <p>Serial: ${viewQrAsset.serial}</p>
                            <p>${customer.name}</p>
                        </div>
                        <script>window.print();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="" size="xl">
                {/* Custom Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {customer.name}
                            {membership && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-bold">Gold Member</span>}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {customer.address}
                            {customer.city && `, ${customer.city}`}
                            {customer.state && `, ${customer.state}`}
                            {customer.zip && ` ${customer.zip}`}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSendInvite} disabled={isSendingInvite} variant="secondary" className="text-xs flex items-center gap-2">
                            <Mail size={14} /> {isSendingInvite ? 'Sending...' : 'Send Portal Invite'}
                        </Button>
                        <Button onClick={handleDeleteCustomer} className="bg-red-700 text-white hover:bg-red-800 text-xs font-bold shadow-md border-none">Delete Record</Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
                    {[
                        { id: 'overview', icon: User, label: 'Overview' },
                        { id: 'equipment', icon: Wrench, label: 'Equipment' },
                        { id: 'history', icon: FileText, label: 'Service History' },
                        { id: 'financials', icon: DollarSign, label: 'Financials' },
                        { id: 'docs', icon: Image, label: 'Docs & Media' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="h-[50vh] overflow-y-auto custom-scrollbar p-1">
                    
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-gray-900 dark:text-white">Contact Details</h3>
                                    <button onClick={() => { setIsEditing(!isEditing); setFormData(customer); }} className="text-xs text-primary-600 hover:underline">
                                        {isEditing ? 'Cancel' : 'Edit'}
                                    </button>
                                </div>
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <Input label="Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                                        <Input label="Email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                                        <Input label="Phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                        
                                        <Input label="Street Address" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <Input label="City" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} />
                                            <Input label="State" value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})} />
                                            <Input label="Zip" value={formData.zip || ''} onChange={e => setFormData({...formData, zip: e.target.value})} />
                                        </div>
                                        
                                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border dark:border-slate-700">
                                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Marketing Consent (Manual Override)</p>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.marketingConsent?.sms || false} 
                                                        onChange={e => setFormData({
                                                            ...formData, 
                                                            marketingConsent: { 
                                                                ...formData.marketingConsent, 
                                                                sms: e.target.checked,
                                                                agreedAt: new Date().toISOString(),
                                                                source: 'Manual'
                                                            } as any
                                                        })} 
                                                    />
                                                    <span className="text-sm dark:text-slate-300">SMS Opt-In</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.marketingConsent?.email || false} 
                                                        onChange={e => setFormData({
                                                            ...formData, 
                                                            marketingConsent: { 
                                                                ...formData.marketingConsent, 
                                                                email: e.target.checked,
                                                                agreedAt: new Date().toISOString(),
                                                                source: 'Manual'
                                                            } as any
                                                        })} 
                                                    />
                                                    <span className="text-sm dark:text-slate-300">Email Opt-In</span>
                                                </label>
                                            </div>
                                        </div>

                                        <Textarea label="Internal Notes" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Gate codes, warnings, preferences..." />
                                        
                                        <Button onClick={handleSaveOverview}>Save Changes</Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div><p className="text-gray-500">Email</p><p className="font-medium dark:text-white">{customer.email || 'N/A'}</p></div>
                                        <div><p className="text-gray-500">Phone</p><p className="font-medium dark:text-white">{customer.phone || 'N/A'}</p></div>
                                        <div className="col-span-2">
                                            <p className="text-gray-500">Address</p>
                                            <p className="font-medium dark:text-white">
                                                {customer.address}<br/>
                                                {customer.city ? `${customer.city}, ` : ''}{customer.state || ''} {customer.zip || ''}
                                            </p>
                                        </div>
                                        {customer.notes && (
                                            <div className="col-span-2 mt-2">
                                                <p className="text-gray-500">Notes</p>
                                                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded text-gray-800 dark:text-gray-200 border border-yellow-100 dark:border-yellow-900/30 whitespace-pre-wrap">
                                                    {customer.notes}
                                                </div>
                                            </div>
                                        )}
                                        {/* Consent Display */}
                                        <div className="col-span-2 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2 uppercase flex items-center gap-2">
                                                <MessageSquare size={12}/> Marketing Permissions
                                            </p>
                                            {customer.marketingConsent?.sms || customer.marketingConsent?.email ? (
                                                <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-300">
                                                    <span className={`flex items-center gap-1 ${customer.marketingConsent.sms ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
                                                        <CheckCircle size={14} className="text-green-500"/> SMS
                                                    </span>
                                                    <span className={`flex items-center gap-1 ${customer.marketingConsent.email ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
                                                        <CheckCircle size={14} className="text-green-500"/> Email
                                                    </span>
                                                    <span className="text-slate-400 ml-auto">
                                                        Agreed: {new Date(customer.marketingConsent.agreedAt).toLocaleDateString()} via {customer.marketingConsent.source}
                                                    </span>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">No consent recorded.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="md:col-span-1">
                                <div className="bg-gray-200 dark:bg-gray-700 w-full h-40 rounded flex items-center justify-center text-gray-500 text-xs">
                                    <MapPinIcon className="mr-1"/> Map Preview
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'equipment' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-900 dark:text-white">Assets</h3>
                                <Button onClick={() => { setIsAddingEquip(true); setNewEquipment({ id: '', brand: '', model: '', serial: '', type: 'Split System' }); }} className="w-auto text-xs py-1">+ Add Equipment</Button>
                            </div>
                            
                            {isAddingEquip && (
                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded mb-4 border border-gray-200 dark:border-gray-700">
                                    <h4 className="text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">{newEquipment.id ? 'Edit Asset' : 'New Asset'}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                                        <Input label="Brand" value={newEquipment.brand || ''} onChange={e => setNewEquipment({...newEquipment, brand: e.target.value})} />
                                        <Input label="Model" value={newEquipment.model || ''} onChange={e => setNewEquipment({...newEquipment, model: e.target.value})} />
                                        <Input label="Serial" value={newEquipment.serial || ''} onChange={e => setNewEquipment({...newEquipment, serial: e.target.value})} />
                                        <Input label="Location (e.g. Attic)" value={newEquipment.location || ''} onChange={e => setNewEquipment({...newEquipment, location: e.target.value})} />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="secondary" onClick={() => setIsAddingEquip(false)}>Cancel</Button>
                                        <Button onClick={handleAddEquipment} disabled={isSavingAsset}>{isSavingAsset ? 'Saving...' : 'Save Asset'}</Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {customer.equipment?.map(asset => (
                                    <div key={asset.id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-sm">
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{asset.brand} {asset.type}</p>
                                            <p className="text-xs text-gray-500">M: {asset.model} • S: {asset.serial}</p>
                                            <p className="text-xs text-gray-500">Loc: {asset.location || 'N/A'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setViewQrAsset(asset)} className="text-blue-500 hover:text-blue-700" title="Generate QR Code">
                                                <QrCode size={18} />
                                            </button>
                                            <button onClick={() => handleEditEquipment(asset)} className="text-slate-500 hover:text-blue-600" title="Edit Asset">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => handleDeleteEquipment(asset.id)} className="text-red-400 hover:text-red-600" title="Delete Asset">
                                                <TrashIcon size={18}/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {(!customer.equipment || customer.equipment.length === 0) && <p className="text-center text-gray-500 text-sm py-4">No equipment listed.</p>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Service</th>
                                    <th className="px-4 py-2">Tech</th>
                                    <th className="px-4 py-2">Total</th>
                                    <th className="px-4 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {customerJobs.map(job => (
                                    <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                        <td className="px-4 py-3 text-gray-900 dark:text-white">{new Date(job.appointmentTime).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">{job.tasks.join(', ')}</td>
                                        <td className="px-4 py-3">{job.assignedTechnicianName}</td>
                                        <td className="px-4 py-3 font-bold">${(job.invoice?.amount || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${job.jobStatus === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{job.jobStatus}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-gray-900 dark:text-white">Active Membership</h4>
                                {!membership && (
                                    <Button 
                                        onClick={() => setIsEnrolling(!isEnrolling)} 
                                        className="w-auto text-xs py-1 flex items-center gap-1 bg-purple-600 hover:bg-purple-700"
                                    >
                                        <Sparkles size={14}/> Enroll Customer
                                    </Button>
                                )}
                            </div>

                            {isEnrolling && (
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded border border-purple-200 dark:border-purple-800 animate-fade-in">
                                    <p className="text-xs font-bold text-purple-700 mb-3 uppercase">Choose Plan for Staff Enrollment</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-3 gap-3">
                                        {state.membershipPlans.map(plan => (
                                            <button 
                                                key={plan.id}
                                                onClick={() => handleManualEnroll(plan)}
                                                className="p-3 bg-white dark:bg-gray-800 border-2 border-purple-100 dark:purple-800 rounded-lg hover:border-purple-500 text-left transition-all"
                                            >
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">{plan.name}</p>
                                                <p className="text-xs text-primary-600 font-bold">${plan.monthlyPrice}/mo</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{plan.visitsPerYear} Visits • {plan.discountPercentage}% Off</p>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => setIsEnrolling(false)} className="text-xs text-gray-500 mt-3 hover:underline">Cancel Enrollment</button>
                                </div>
                            )}

                            {membership ? (
                                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200 dark:border-green-800 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full text-green-600">
                                            <ShieldCheck size={20}/>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-green-800 dark:text-green-300">{membership.planName} Membership</h4>
                                            <p className="text-xs text-green-700 dark:text-green-400">Valid until {new Date(membership.endDate).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="bg-green-200 text-green-800 text-[10px] px-2 py-1 rounded font-bold">ACTIVE</span>
                                        <p className="text-xs text-green-600 font-bold mt-1">{membership.visitsRemaining} Visits Left</p>
                                    </div>
                                </div>
                            ) : !isEnrolling && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 italic">
                                    No active membership plan found.
                                </div>
                            )}
                            
                            <h4 className="font-bold text-gray-900 dark:text-white mt-6">Billing History</h4>
                            <div className="space-y-2">
                                {invoices.map((inv, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-gray-700 border rounded">
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-white">#{inv.id}</p>
                                            <p className="text-xs text-gray-500">{new Date(inv.jobDate).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900 dark:text-white">${inv.amount.toFixed(2)}</p>
                                            <span className={`text-xs font-bold ${inv.status === 'Paid' ? 'text-green-600' : 'text-red-600'}`}>{inv.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'docs' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
                            <label className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded flex flex-col items-center justify-center h-32 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-400">
                                <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />
                                <PlusCircle size={24} />
                                <span className="text-xs mt-2">Upload</span>
                            </label>
                            {allFiles.map(file => (
                                <div 
                                    key={file.id} 
                                    onClick={() => setViewingFile(file)}
                                    className="relative group bg-gray-100 dark:bg-gray-700 rounded h-32 overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all shadow-sm"
                                >
                                    {file.fileType.includes('image') ? (
                                        <img src={file.dataUrl || (file as any).url} alt={file.fileName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500 p-2 text-center">
                                            <FileText size={24} className="mb-1 text-gray-400"/>
                                            <span className="truncate w-full">{file.fileName}</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] p-2 text-center">
                                        <p className="font-bold truncate w-full">{file.fileName}</p>
                                        <p className="opacity-75">{new Date(file.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* FILE PREVIEW MODAL */}
            {viewingFile && (
                <Modal isOpen={!!viewingFile} onClose={() => setViewingFile(null)} title={viewingFile.fileName || "File Preview"} size="lg">
                    <div className="space-y-4 p-4">
                        <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh] shadow-2xl">
                            {viewingFile.fileType.includes('image') ? (
                                <img src={viewingFile.dataUrl || (viewingFile as any).url} className="max-w-full max-h-full object-contain" alt="Preview"/>
                            ) : viewingFile.fileType.includes('pdf') ? (
                                <iframe src={viewingFile.dataUrl} className="w-full h-[60vh] border-0" title="PDF Preview" />
                            ) : (
                                <div className="p-12 text-center text-white">
                                    <FileText size={64} className="mx-auto mb-4 text-slate-500"/>
                                    <p className="font-bold">No preview available</p>
                                    <p className="text-sm text-slate-400 mt-1 mb-6">This file type ({viewingFile.fileType}) cannot be previewed directly.</p>
                                    <a 
                                        href={viewingFile.dataUrl} 
                                        download={viewingFile.fileName} 
                                        className="bg-primary-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-primary-700 transition-colors"
                                    >
                                        Download File
                                    </a>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="flex-1 min-w-0 pr-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewingFile.fileType}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{viewingFile.fileName}</p>
                            </div>
                            <Button variant="secondary" onClick={() => setViewingFile(null)} className="flex-shrink-0">Close Window</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* QR CODE MODAL */}
            {viewQrAsset && (
                <Modal isOpen={!!viewQrAsset} onClose={() => setViewQrAsset(null)} title="Asset Tag QR">
                    <div className="flex flex-col items-center justify-center p-6 space-y-4">
                        <div className="bg-white p-4 rounded border-2 border-black">
                            <QRCodeCanvas 
                                id="asset-qr-canvas"
                                value={`${window.location.origin}/#/asset/${customerId}?assetId=${viewQrAsset.id}`} 
                                size={200}
                                level="H"
                            />
                        </div>
                        <div className="text-center text-sm text-gray-600 dark:text-gray-300">
                            <p className="font-bold text-lg">{viewQrAsset.brand} {viewQrAsset.type}</p>
                            <p className="font-mono text-xs">S/N: {viewQrAsset.serial}</p>
                            <p className="mt-2 text-xs text-gray-500">Scan this code to view asset history.</p>
                        </div>
                        <Button onClick={handlePrintQr} className="w-auto flex items-center gap-2">
                            <Printer size={16} /> Print Label
                        </Button>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default CustomerMasterModal;
