import React, { useState } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import Card from 'components/ui/Card';
import { 
    User, Building, FileText, Upload, Trash2, Download, Eye, 
    PlusCircle, CheckCircle, Shield, AlertTriangle, LogOut, Calendar, MapPin
} from 'lucide-react';
import type { Customer, ServiceLocation, Organization } from 'types';
import { uploadFileToStorage } from 'lib/storageService';
import showToast from 'lib/toast';

export interface CustomerCompanyDoc {
    id: string;
    name: string;
    type: 'Tax Exemption' | 'Insurance (COI)' | 'W-9 Form' | 'Business License' | 'Property Authorization' | 'Other';
    url: string;
    dataUrl?: string;
    uploadedAt: string;
    expiresAt?: string;
    notes?: string;
    size?: string;
}

interface CustomerProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer;
    organization: Organization | null;
    onSaveProfile: (updatedData: Partial<Customer>) => Promise<void>;
    onDeleteAccount: () => void;
}

type ProfileTab = 'contact' | 'locations' | 'documents';

const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
    isOpen,
    onClose,
    customer,
    organization,
    onSaveProfile,
    onDeleteAccount
}) => {
    const [activeTab, setActiveTab] = useState<ProfileTab>('contact');
    const [isSaving, setIsSaving] = useState(false);

    // Form states
    const [name, setName] = useState(customer.name || '');
    const [firstName, setFirstName] = useState(customer.firstName || '');
    const [lastName, setLastName] = useState(customer.lastName || '');
    const [phone, setPhone] = useState(customer.phone || '');
    const [address, setAddress] = useState(customer.address || '');
    const [notes, setNotes] = useState(customer.notes || '');
    const [serviceLocations, setServiceLocations] = useState<ServiceLocation[]>(customer.serviceLocations || []);
    const [documents, setDocuments] = useState<CustomerCompanyDoc[]>(
        ((customer as any).documents || (customer as any).companyDocuments || []) as CustomerCompanyDoc[]
    );
    const [profilePhotoUrl, setProfilePhotoUrl] = useState(customer.profilePhotoUrl || '');
    const [uploadPhotoFile, setUploadPhotoFile] = useState<File | null>(null);

    // New Document Upload State
    const [newDocType, setNewDocType] = useState<CustomerCompanyDoc['type']>('Tax Exemption');
    const [newDocName, setNewDocName] = useState('');
    const [newDocExpires, setNewDocExpires] = useState('');
    const [newDocNotes, setNewDocNotes] = useState('');
    const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let finalPhotoUrl = profilePhotoUrl;
            if (uploadPhotoFile) {
                const safeName = uploadPhotoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
                const path = `organizations/${organization?.id || 'unknown'}/customers/${customer.id}/profile_${Date.now()}_${safeName}`;
                finalPhotoUrl = await uploadFileToStorage(path, uploadPhotoFile);
            }

            await onSaveProfile({
                name,
                firstName,
                lastName,
                phone,
                address,
                notes,
                serviceLocations,
                documents,
                companyDocuments: documents,
                profilePhotoUrl: finalPhotoUrl || undefined
            } as any);

            showToast.success('Profile details saved successfully.');
            onClose();
        } catch (err: any) {
            console.error('Failed to save profile:', err);
            showToast.error('Failed to save profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUploadDocument = async () => {
        if (!selectedDocFile) {
            showToast.warn('Please select a file to upload (PDF, PNG, JPG).');
            return;
        }

        setIsUploadingDoc(true);
        try {
            const safeName = selectedDocFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
            const path = `organizations/${organization?.id || 'unknown'}/customers/${customer.id}/compliance_${Date.now()}_${safeName}`;
            
            let fileUrl = '';
            try {
                fileUrl = await uploadFileToStorage(path, selectedDocFile);
            } catch (storageErr) {
                // Fallback to base64 encoding if offline/emulator
                const reader = new FileReader();
                fileUrl = await new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(selectedDocFile);
                });
            }

            const docTitle = newDocName.trim() || selectedDocFile.name.replace(/\.[^/.]+$/, '');
            const newDoc: CustomerCompanyDoc = {
                id: `doc-${Date.now()}`,
                name: docTitle,
                type: newDocType,
                url: fileUrl,
                dataUrl: fileUrl,
                uploadedAt: new Date().toISOString(),
                expiresAt: newDocExpires ? new Date(newDocExpires).toISOString() : undefined,
                notes: newDocNotes.trim() || undefined,
                size: (selectedDocFile.size / 1024).toFixed(1) + ' KB'
            };

            const updatedDocs = [newDoc, ...documents];
            setDocuments(updatedDocs);

            // Auto-save to customer profile record
            await onSaveProfile({
                documents: updatedDocs,
                companyDocuments: updatedDocs
            } as any);

            showToast.success(`Uploaded "${docTitle}" successfully!`);
            
            // Reset upload form
            setSelectedDocFile(null);
            setNewDocName('');
            setNewDocExpires('');
            setNewDocNotes('');
        } catch (err: any) {
            console.error('Document upload error:', err);
            showToast.error('Error uploading document: ' + (err.message || String(err)));
        } finally {
            setIsUploadingDoc(false);
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        const updatedDocs = documents.filter(d => d.id !== docId);
        setDocuments(updatedDocs);
        try {
            await onSaveProfile({
                documents: updatedDocs,
                companyDocuments: updatedDocs
            } as any);
            showToast.success('Document removed.');
        } catch (err) {
            console.error(err);
            showToast.error('Failed to remove document.');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Account Settings & Company Hub" size="xl">
            <div className="space-y-6">
                {/* Header Profile Summary */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary-500 bg-slate-200 flex items-center justify-center relative group shrink-0">
                        {uploadPhotoFile ? (
                            <img src={URL.createObjectURL(uploadPhotoFile)} className="w-full h-full object-cover" alt="Avatar" />
                        ) : profilePhotoUrl ? (
                            <img src={profilePhotoUrl} className="w-full h-full object-cover" alt="Profile" />
                        ) : (
                            <User size={28} className="text-slate-400" />
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-bold text-center px-1">
                            Change Photo
                            <input type="file" className="hidden" accept="image/*" onChange={e => setUploadPhotoFile(e.target.files?.[0] || null)} />
                        </label>
                    </div>

                    <div className="text-center sm:text-left flex-1">
                        <h3 className="text-base font-black text-slate-900 dark:text-white">{name || customer.name}</h3>
                        <p className="text-xs text-slate-500">{customer.email}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 justify-center sm:justify-start">
                            <span className="text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold px-2 py-0.5 rounded-md">
                                {customer.customerType || 'Commercial Account'}
                            </span>
                            {documents.some(d => d.type === 'Tax Exemption') && (
                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Shield size={10} /> Tax-Exempt Certified
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('contact')}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'contact'
                                ? 'bg-primary-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <User size={14} className="shrink-0" /> <span>Profile &amp; Contact</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('locations')}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'locations'
                                ? 'bg-primary-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <Building size={14} className="shrink-0" /> <span>Properties ({serviceLocations.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('documents')}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'documents'
                                ? 'bg-primary-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                        <FileText size={14} className="shrink-0" /> <span>Documents ({documents.length})</span>
                    </button>
                </div>

                {/* TAB 1: Profile & Contact Details */}
                {activeTab === 'contact' && (
                    <form onSubmit={handleSaveGeneral} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input label="Company / Account Name" value={name} onChange={e => setName(e.target.value)} required />
                            <Input label="Primary Phone Number" value={phone} onChange={e => setPhone(e.target.value)} required />
                            <Input label="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} />
                            <Input label="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} />
                        </div>

                        <div>
                            <Input 
                                label="Primary Address / Corporate Headquarters" 
                                value={typeof address === 'string' ? address : ''} 
                                onChange={e => setAddress(e.target.value as any)} 
                            />
                        </div>

                        <div>
                            <Textarea 
                                label="Access Instructions / Gate Codes / Notes" 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                rows={2} 
                                placeholder="E.g. Loading dock code #4490, security check-in required at gate 2"
                            />
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={onDeleteAccount}
                                className="text-red-500 text-xs font-bold hover:underline flex items-center gap-1"
                            >
                                <LogOut size={12} /> Delete Account
                            </button>

                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={onClose} className="text-xs">Cancel</Button>
                                <Button type="submit" disabled={isSaving} className="text-xs bg-primary-600">
                                    {isSaving ? 'Saving...' : 'Save Profile Changes'}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}

                {/* TAB 2: Properties & Locations */}
                {activeTab === 'locations' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-slate-500 font-medium">
                                Manage secondary service sites, branch facilities, and distribution centers for this account.
                            </p>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                size="sm"
                                onClick={() => {
                                    const newLoc: ServiceLocation = {
                                        id: `loc-${Date.now()}`,
                                        name: 'New Location',
                                        propertyName: '',
                                        address: '',
                                        building: '',
                                        contacts: [{ name: '', phone: '', role: 'Site Contact' }]
                                    };
                                    setServiceLocations([...serviceLocations, newLoc]);
                                }} 
                                className="text-xs flex items-center gap-1 py-1"
                            >
                                <PlusCircle size={14} /> Add Property
                            </Button>
                        </div>

                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                            {serviceLocations.map((loc, idx) => (
                                <div key={loc.id} className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                                            <Input 
                                                label="Property Name / Facility Label" 
                                                value={loc.propertyName || loc.name || ''} 
                                                onChange={e => {
                                                    const updated = [...serviceLocations];
                                                    updated[idx].propertyName = e.target.value;
                                                    updated[idx].name = e.target.value;
                                                    setServiceLocations(updated);
                                                }} 
                                                placeholder="e.g. North Distribution Hub"
                                            />
                                            <Input 
                                                label="Building / Suite / Bay" 
                                                value={loc.building || loc.subLocationName || ''} 
                                                onChange={e => {
                                                    const updated = [...serviceLocations];
                                                    updated[idx].building = e.target.value;
                                                    setServiceLocations(updated);
                                                }} 
                                                placeholder="e.g. Bldg B, Suite 200"
                                            />
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setServiceLocations(serviceLocations.filter(l => l.id !== loc.id))}
                                            className="text-red-400 hover:text-red-600 p-2 mt-5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                            title="Delete Property"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <Input 
                                        label="Physical Street Address" 
                                        value={loc.address || ''} 
                                        onChange={e => {
                                            const updated = [...serviceLocations];
                                            updated[idx].address = e.target.value;
                                            setServiceLocations(updated);
                                        }} 
                                        placeholder="e.g. 9400 Metric Blvd, Austin, TX 78758"
                                    />

                                    {/* On-Site Contacts */}
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-black uppercase text-slate-400">On-Site Facility Contacts</span>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const updated = [...serviceLocations];
                                                    if (!updated[idx].contacts) updated[idx].contacts = [];
                                                    updated[idx].contacts!.push({ name: '', phone: '', role: 'Site Lead' });
                                                    setServiceLocations(updated);
                                                }}
                                                className="text-[10px] font-bold text-primary-600 hover:underline"
                                            >
                                                + Add Contact
                                            </button>
                                        </div>

                                        {(loc.contacts || []).map((c, cIdx) => (
                                            <div key={cIdx} className="flex gap-2 items-center mb-1.5">
                                                <input 
                                                    type="text" 
                                                    placeholder="Contact Name" 
                                                    value={c.name} 
                                                    onChange={e => {
                                                        const updated = [...serviceLocations];
                                                        updated[idx].contacts![cIdx].name = e.target.value;
                                                        setServiceLocations(updated);
                                                    }}
                                                    className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-1"
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Phone" 
                                                    value={c.phone} 
                                                    onChange={e => {
                                                        const updated = [...serviceLocations];
                                                        updated[idx].contacts![cIdx].phone = e.target.value;
                                                        setServiceLocations(updated);
                                                    }}
                                                    className="text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-1"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = [...serviceLocations];
                                                        updated[idx].contacts = updated[idx].contacts?.filter((_, i) => i !== cIdx);
                                                        setServiceLocations(updated);
                                                    }}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {serviceLocations.length === 0 && (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 font-bold">
                                    No secondary service locations added yet. Click "+ Add Property" above to register branch locations.
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Button variant="secondary" onClick={onClose} className="text-xs">Cancel</Button>
                            <Button 
                                onClick={handleSaveGeneral} 
                                disabled={isSaving} 
                                className="text-xs bg-primary-600"
                            >
                                {isSaving ? 'Saving...' : 'Save Location Updates'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* TAB 3: Company Documents & Tax Exemption Certificates */}
                {activeTab === 'documents' && (
                    <div className="space-y-6">
                        {/* Upload Form Box */}
                        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-900/50 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                                <Upload size={18} />
                                <span>Upload Company Document or Tax Certificate</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Document Category</label>
                                    <select
                                        value={newDocType}
                                        onChange={e => setNewDocType(e.target.value as any)}
                                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-white"
                                    >
                                        <option value="Tax Exemption">Tax Exemption Certificate (Resale / 501c3)</option>
                                        <option value="Insurance (COI)">Certificate of Insurance (COI)</option>
                                        <option value="W-9 Form">W-9 Taxpayer ID Form</option>
                                        <option value="Business License">Business License / Facility Permit</option>
                                        <option value="Property Authorization">Property / Tenant Authorization Letter</option>
                                        <option value="Other">Other Business Document</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Document Title / Label</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Texas Sales Tax Exemption 2026-2027"
                                        value={newDocName}
                                        onChange={e => setNewDocName(e.target.value)}
                                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Expiration Date (Optional)</label>
                                    <input
                                        type="date"
                                        value={newDocExpires}
                                        onChange={e => setNewDocExpires(e.target.value)}
                                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">File Attachment (PDF, JPG, PNG)</label>
                                    <input
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                        onChange={e => setSelectedDocFile(e.target.files?.[0] || null)}
                                        className="w-full text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-1">
                                <Button
                                    type="button"
                                    onClick={handleUploadDocument}
                                    disabled={isUploadingDoc || !selectedDocFile}
                                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                                >
                                    {isUploadingDoc ? 'Uploading File...' : 'Upload & Attach Document'}
                                </Button>
                            </div>
                        </div>

                        {/* List of Attached Documents */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                                Active Compliance & Company Certificates ({documents.length})
                            </h4>

                            {documents.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 font-bold">
                                    No tax certificates or company documents uploaded yet.
                                </div>
                            ) : (
                                documents.map(doc => (
                                    <div 
                                        key={doc.id}
                                        className="p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3 hover:border-primary-400 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                <Shield size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">{doc.name}</h5>
                                                    <span className="text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                                                        {doc.type}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                                    <span>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                                    {doc.expiresAt && <span>· Exp: {new Date(doc.expiresAt).toLocaleDateString()}</span>}
                                                    {doc.size && <span>· {doc.size}</span>}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <a
                                                href={doc.url || doc.dataUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                download={doc.name}
                                                className="p-2 text-slate-500 hover:text-primary-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                title="Download / View Document"
                                            >
                                                <Download size={16} />
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteDoc(doc.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                title="Delete Document"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CustomerProfileModal;
