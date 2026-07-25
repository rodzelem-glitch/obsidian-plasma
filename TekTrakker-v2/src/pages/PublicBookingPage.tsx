import { cleanUndefinedFields } from '../lib/utils';
import showToast from "lib/toast";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from 'lib/firebase';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import type { Organization } from 'types';
import { CheckCircle, Home, Users, Building, ClipboardList, HardHat, UploadCloud } from 'lucide-react';
import { uploadFileToStorage } from 'lib/storageService';

const PublicBookingPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const orgId = searchParams.get('oid');
    const [org, setOrg] = useState<Organization | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Customer Type Selection
    const [customerType, setCustomerType] = useState<'Homeowner' | 'Renter / Tenant' | 'Business / Commercial' | 'Property Manager' | 'General Contractor'>('Homeowner');
    
    // Contact & Address Details by customer type
    // Homeowner
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [isOwner, setIsOwner] = useState('Yes');
    const [ownerName, setOwnerName] = useState('');
    const [ownerPhone, setOwnerPhone] = useState('');

    // Renter / Tenant
    const [tenantName, setTenantName] = useState('');
    const [tenantPhone, setTenantPhone] = useState('');
    const [tenantEmail, setTenantEmail] = useState('');
    const [tenantAddress, setTenantAddress] = useState('');
    const [landlordName, setLandlordName] = useState('');
    const [landlordPhone, setLandlordPhone] = useState('');

    // Business / Commercial
    const [businessName, setBusinessName] = useState('');
    const [storeLocation, setStoreLocation] = useState('');
    const [onSiteContactName, setOnSiteContactName] = useState('');
    const [commercialPhone, setCommercialPhone] = useState('');
    const [commercialEmail, setCommercialEmail] = useState('');
    const [commercialAddress, setCommercialAddress] = useState('');
    const [authorizedToApprove, setAuthorizedToApprove] = useState('Yes');
    const [billingEmail, setBillingEmail] = useState('');
    const [poRequired, setPoRequired] = useState('No');
    const [approvalLimit, setApprovalLimit] = useState('$500');
    const [taxExempt, setTaxExempt] = useState('No');

    // Property Manager
    const [pmCompanyName, setPmCompanyName] = useState('');
    const [pmContactName, setPmContactName] = useState('');
    const [pmPhone, setPmPhone] = useState('');
    const [pmEmail, setPmEmail] = useState('');
    const [pmAddress, setPmAddress] = useState('');
    const [ownerApprovalRequired, setOwnerApprovalRequired] = useState('Yes');

    // General Contractor
    const [gcCompanyName, setGcCompanyName] = useState('');
    const [gcContactName, setGcContactName] = useState('');
    const [gcPhone, setGcPhone] = useState('');
    const [gcEmail, setGcEmail] = useState('');
    const [gcAddress, setGcAddress] = useState('');
    const [gcJobName, setGcJobName] = useState('');

    // Service & Scheduling Details
    const [serviceCategory, setServiceCategory] = useState('HVAC');
    const [jobType, setJobType] = useState('Emergency Repair');
    const [issueSummary, setIssueSummary] = useState('');
    const [preferredDate, setPreferredDate] = useState('');
    const [arrivalWindow, setArrivalWindow] = useState('8am - 11am');

    // Extras / Uploads
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [taxExemptFile, setTaxExemptFile] = useState<File | null>(null);

    const serviceCategories = ['HVAC', 'Plumbing', 'Electrical', 'Other'];
    const jobTypes = ['Emergency Repair', 'Maintenance / Tune-up', 'New Installation', 'Quote / Estimate'];
    const arrivalWindows = ['8am - 11am', '11am - 2pm', '2pm - 5pm', '5pm - 8pm (After Hours)'];

    useEffect(() => {
        const fetchOrg = async () => {
            if (orgId) {
                try {
                    const doc = await db.collection('organizations').doc(orgId).get();
                    if (doc.exists) {
                        const orgData = { ...doc.data(), id: doc.id } as Organization;
                        setOrg(orgData);
                        if (orgData.industry && serviceCategories.includes(orgData.industry)) {
                            setServiceCategory(orgData.industry);
                        }
                    }
                } catch (e) {
                    console.error("Org fetch failed", e);
                }
            } else {
                try {
                    const platformDoc = await db.collection('organizations').doc('platform').get();
                    if (platformDoc.exists) {
                        setOrg({ ...platformDoc.data(), id: 'platform' } as Organization);
                    }
                } catch (e) {
                    console.warn("Could not fetch platform settings", e);
                }
            }
        };
        fetchOrg();
    }, [orgId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const targetOrgId = orgId ? org?.id : 'unaffiliated';
        const smtp = org?.smtpConfig;

        try {
            // File uploads
            let photoUrl = '';
            if (photoFile) {
                const ext = photoFile.name.split('.').pop() || 'jpg';
                const path = `organizations/${targetOrgId}/booking_photos/${Date.now()}_photo.${ext}`;
                photoUrl = await uploadFileToStorage(path, photoFile);
            }

            let taxExemptUrl = '';
            if (taxExemptFile) {
                const ext = taxExemptFile.name.split('.').pop() || 'pdf';
                const path = `organizations/${targetOrgId}/certificates/${Date.now()}_certificate.${ext}`;
                taxExemptUrl = await uploadFileToStorage(path, taxExemptFile);
            }

            // Map details based on selected customer type
            let finalName = '';
            let finalPhone = '';
            let finalEmail = '';
            let finalAddress = '';
            const specialInstructionsParts: string[] = [];

            if (customerType === 'Business / Commercial') {
                finalName = businessName || onSiteContactName || '';
                finalPhone = commercialPhone;
                finalEmail = commercialEmail;
                finalAddress = commercialAddress;
                specialInstructionsParts.push(`Customer Type: Business / Commercial`);
                specialInstructionsParts.push(`Business Name: ${businessName || 'N/A'}`);
                specialInstructionsParts.push(`Store/Location #: ${storeLocation || 'N/A'}`);
                specialInstructionsParts.push(`On-Site Contact Name: ${onSiteContactName || 'N/A'}`);
                specialInstructionsParts.push(`Authorized to request? ${authorizedToApprove || 'N/A'}`);
                specialInstructionsParts.push(`Billing Email: ${billingEmail || 'N/A'}`);
                specialInstructionsParts.push(`PO Required? ${poRequired || 'N/A'}`);
                specialInstructionsParts.push(`Approval Limit: ${approvalLimit || 'N/A'}`);
                specialInstructionsParts.push(`Tax Exempt? ${taxExempt || 'N/A'}`);
            } else if (customerType === 'Renter / Tenant') {
                finalName = tenantName;
                finalPhone = tenantPhone;
                finalEmail = tenantEmail;
                finalAddress = tenantAddress;
                specialInstructionsParts.push(`Customer Type: Renter / Tenant`);
                specialInstructionsParts.push(`Landlord Name: ${landlordName || 'N/A'}`);
                specialInstructionsParts.push(`Landlord Phone: ${landlordPhone || 'N/A'}`);
            } else if (customerType === 'Property Manager') {
                finalName = pmContactName;
                finalPhone = pmPhone;
                finalEmail = pmEmail;
                finalAddress = pmAddress;
                specialInstructionsParts.push(`Customer Type: Property Manager`);
                specialInstructionsParts.push(`Management Company: ${pmCompanyName || 'N/A'}`);
                specialInstructionsParts.push(`Owner Approval Required? ${ownerApprovalRequired || 'N/A'}`);
                specialInstructionsParts.push(`Billing/AP Email: ${billingEmail || 'N/A'}`);
                specialInstructionsParts.push(`Tax Exempt? ${taxExempt || 'N/A'}`);
            } else if (customerType === 'General Contractor') {
                finalName = gcContactName;
                finalPhone = gcPhone;
                finalEmail = gcEmail;
                finalAddress = gcAddress;
                specialInstructionsParts.push(`Customer Type: General Contractor`);
                specialInstructionsParts.push(`GC Company: ${gcCompanyName || 'N/A'}`);
                specialInstructionsParts.push(`Job Name/Reference #: ${gcJobName || 'N/A'}`);
                specialInstructionsParts.push(`Billing/AP Email: ${billingEmail || 'N/A'}`);
                specialInstructionsParts.push(`PO Required? ${poRequired || 'N/A'}`);
                specialInstructionsParts.push(`Tax Exempt? ${taxExempt || 'N/A'}`);
            } else {
                // Homeowner
                finalName = name;
                finalPhone = phone;
                finalEmail = email;
                finalAddress = address;
                specialInstructionsParts.push(`Customer Type: Homeowner`);
                if (isOwner === 'No') {
                    specialInstructionsParts.push(`Landlord/Owner Name: ${ownerName || 'N/A'}`);
                    specialInstructionsParts.push(`Landlord/Owner Phone: ${ownerPhone || 'N/A'}`);
                }
            }

            if (issueSummary) {
                specialInstructionsParts.push(`Issue Summary: ${issueSummary}`);
            }

            const appointment = {
                organizationId: targetOrgId || 'unaffiliated',
                customerName: finalName,
                customerPhone: finalPhone,
                customerEmail: finalEmail,
                address: finalAddress,
                tasks: [serviceCategory, jobType].filter(Boolean),
                appointmentTime: preferredDate ? new Date(preferredDate).toISOString() : new Date().toISOString(),
                status: 'Pending',
                source: 'PublicBooking',
                specialInstructions: specialInstructionsParts.join(' | '),
                businessType: serviceCategory,
                createdAt: new Date().toISOString(),
                photoUrl: photoUrl || null,
                taxExemptUrl: taxExemptUrl || null,
                marketingConsent: {
                    sms: true,
                    email: true,
                    agreedAt: new Date().toISOString(),
                    source: 'PublicBookingPage'
                }
            };

            await db.collection('appointments').add(cleanUndefinedFields(appointment));

            const toAddresses = [];
            if (orgId && org?.email) toAddresses.push(org.email);
            if (orgId && org?.notificationEmails) toAddresses.push(...org.notificationEmails);
            if (toAddresses.length === 0 || !orgId) toAddresses.push('platform@tektrakker.com');

            const subject = orgId ? `New Booking Request: ${finalName}` : `[Find a Pro] New Lead: ${finalName}`;

            const { notifyAdmins } = await import('lib/notificationService');
            await notifyAdmins(targetOrgId || 'platform', {
                title: "New Appointment Request",
                body: `${finalName} requested a ${jobType} appointment.`,
                type: 'booking'
            });

            await db.collection('mail_queue').add(cleanUndefinedFields({
                to: toAddresses,
                cc: org?.email ? [org.email] : [],
                replyTo: finalEmail || 'noreply@tektrakker.com',
                message: {
                    subject: subject,
                    text: `New booking request.\n\nCustomer: ${finalName}\nPhone: ${finalPhone}\nService: ${jobType} (${serviceCategory})\nDate Requested: ${preferredDate}\nAddress: ${finalAddress}\n\nLog in to assign this customer.`,
                    html: `
                        <h2>New Service Request</h2>
                        <p><strong>Customer:</strong> ${finalName}</p>
                        <p><strong>Phone:</strong> <a href="tel:${finalPhone}">${finalPhone}</a></p>
                        <p><strong>Email:</strong> ${finalEmail}</p>
                        <p><strong>Address:</strong> ${finalAddress}</p>
                        <hr/>
                        <p><strong>Trade Needed:</strong> ${serviceCategory}</p>
                        <p><strong>Service Type:</strong> ${jobType}</p>
                        <p><strong>Requested Date:</strong> ${preferredDate} (Arrival: ${arrivalWindow})</p>
                        <p><strong>Details:</strong> ${specialInstructionsParts.join('<br>')}</p>
                        ${photoUrl ? `<p><strong>Photo URL:</strong> <a href="${photoUrl}">View Photo</a></p>` : ''}
                        ${taxExemptUrl ? `<p><strong>Tax Exempt Certificate:</strong> <a href="${taxExemptUrl}">View Certificate</a></p>` : ''}
                        <br/>
                        <a href="https://tektrakker.web.app" style="background:#0284c7;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Manage Request</a>
                    `,
                    replyTo: finalEmail || 'noreply@tektrakker.com'
                },
                organizationId: targetOrgId || 'platform',
                type: 'BookingNotification',
                createdAt: new Date().toISOString(),
                ...(smtp?.host && smtp?.user ? {
                    transport: {
                        host: smtp.host,
                        port: Number(smtp.port),
                        auth: { user: smtp.user, pass: smtp.pass },
                        from: `"${smtp.fromName || org?.name}" <${smtp.fromEmail || org?.email || 'no-reply@tektrakker.com'}>`
                    }
                } : {})
            }));

            setSuccess(true);
        } catch (e) {
            console.error(e);
            showToast.warn("Booking failed. Please try again or call us.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center py-10 shadow-2xl rounded-2xl border border-slate-100">
                    <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Received!</h2>
                    <p className="text-slate-600 mb-6 px-4">
                        Thank you. We have received your request for a {jobType} ({serviceCategory}).<br/>
                        We will contact you shortly to confirm the appointment.
                    </p>
                    <Button 
                        onClick={() => {
                            setSuccess(false);
                            setName(''); setPhone(''); setEmail(''); setAddress('');
                            setTenantName(''); setTenantPhone(''); setTenantEmail(''); setTenantAddress('');
                            setBusinessName(''); setStoreLocation(''); setOnSiteContactName(''); setCommercialPhone(''); setCommercialEmail(''); setCommercialAddress('');
                            setPmCompanyName(''); setPmContactName(''); setPmPhone(''); setPmEmail(''); setPmAddress('');
                            setGcCompanyName(''); setGcContactName(''); setGcPhone(''); setGcEmail(''); setGcAddress('');
                            setIssueSummary(''); setPreferredDate(''); setPhotoFile(null); setTaxExemptFile(null);
                        }} 
                        variant="secondary"
                    >
                        Book Another
                    </Button>
                </Card>
            </div>
        );
    }

    const brandColor = org?.primaryColor || '#0284c7';

    const customerTypes = [
        { id: 'Homeowner', label: 'Homeowner', icon: Home },
        { id: 'Renter / Tenant', label: 'Renter / Tenant', icon: Users },
        { id: 'Business / Commercial', label: 'Business / Commercial', icon: Building },
        { id: 'Property Manager', label: 'Property Manager', icon: ClipboardList },
        { id: 'General Contractor', label: 'General Contractor', icon: HardHat },
    ];

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans selection:bg-blue-100">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-10">
                    {org?.logoUrl ? (
                         <img src={org.logoUrl} alt={org.name} className="h-16 mx-auto object-contain mb-4" />
                    ) : (
                         <h1 className="text-3xl font-black text-slate-900 mb-2">{orgId ? org?.name : 'Find a Pro'}</h1>
                    )}
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Schedule Your Service</h2>
                    <p className="text-slate-500 mt-1">Select a time that works for you. Our team will handle the rest.</p>
                </div>

                <Card className="shadow-2xl rounded-2xl border border-slate-100 p-6 md:p-8 bg-white">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Customer Type Grid Selector */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Customer Type</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                {customerTypes.map((type) => {
                                    const Icon = type.icon;
                                    const isActive = customerType === type.id;
                                    return (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setCustomerType(type.id as any)}
                                            className={`relative p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                                                isActive
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Icon className={`w-5 h-5 mb-1.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                                            <span className="text-[11px] leading-tight font-medium">{type.label}</span>
                                            {isActive && (
                                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shadow-md">
                                                    ✓
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Dynamic Customer Info Forms */}
                        {customerType === 'Homeowner' && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2">Homeowner Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                                    <Input label="Phone" type="tel" placeholder="(210) 555-1234" value={phone} onChange={e => setPhone(e.target.value)} required />
                                </div>
                                <Input label="Email" type="email" placeholder="name@domain.com" value={email} onChange={e => setEmail(e.target.value)} required />
                                <Input label="Service Address" placeholder="Start typing your address..." value={address} onChange={e => setAddress(e.target.value)} required />
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Are you the property owner?</label>
                                    <div className="flex items-center space-x-6">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="isOwner" value="Yes" checked={isOwner === 'Yes'} onChange={() => setIsOwner('Yes')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            Yes
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="isOwner" value="No" checked={isOwner === 'No'} onChange={() => setIsOwner('No')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            No
                                        </label>
                                    </div>
                                </div>
                                
                                {isOwner === 'No' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-fade-in">
                                        <Input label="Owner's Name" value={ownerName} onChange={e => setOwnerName(e.target.value)} required />
                                        <Input label="Owner's Phone" type="tel" placeholder="(210) 555-1234" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required />
                                    </div>
                                )}
                            </div>
                        )}

                        {customerType === 'Renter / Tenant' && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2">Renter / Tenant Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Tenant Name" value={tenantName} onChange={e => setTenantName(e.target.value)} required />
                                    <Input label="Tenant Phone" type="tel" placeholder="(210) 555-1234" value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} required />
                                </div>
                                <Input label="Tenant Email" type="email" placeholder="tenant@domain.com" value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} required />
                                <Input label="Service Address" placeholder="Start typing your address..." value={tenantAddress} onChange={e => setTenantAddress(e.target.value)} required />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <Input label="Landlord / Owner Name" value={landlordName} onChange={e => setLandlordName(e.target.value)} />
                                    <Input label="Landlord / Owner Phone" type="tel" placeholder="Owner or PM phone" value={landlordPhone} onChange={e => setLandlordPhone(e.target.value)} />
                                </div>
                            </div>
                        )}

                        {customerType === 'Business / Commercial' && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2">Business / Commercial Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Business Name" value={businessName} onChange={e => setBusinessName(e.target.value)} required />
                                    <Input label="Store / Location #" value={storeLocation} onChange={e => setStoreLocation(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Input label="On-Site Contact Name" value={onSiteContactName} onChange={e => setOnSiteContactName(e.target.value)} required />
                                    <Input label="Phone" type="tel" placeholder="(210) 555-1234" value={commercialPhone} onChange={e => setCommercialPhone(e.target.value)} required />
                                    <Input label="Email" type="email" placeholder="name@company.com" value={commercialEmail} onChange={e => setCommercialEmail(e.target.value)} required />
                                </div>
                                <Input label="Service Address" placeholder="Start typing your address..." value={commercialAddress} onChange={e => setCommercialAddress(e.target.value)} required />
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Are you authorized to request and approve service at this location?</label>
                                    <div className="flex items-center space-x-6">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="authorizedToApprove" value="Yes" checked={authorizedToApprove === 'Yes'} onChange={() => setAuthorizedToApprove('Yes')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            Yes
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="authorizedToApprove" value="No" checked={authorizedToApprove === 'No'} onChange={() => setAuthorizedToApprove('No')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            No
                                        </label>
                                    </div>
                                </div>
                                
                                <Input label="Billing Contact Email" type="email" placeholder="billing@company.com" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">PO Required?</label>
                                        <div className="flex items-center space-x-6">
                                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                                <input type="radio" name="poRequired" value="Yes" checked={poRequired === 'Yes'} onChange={() => setPoRequired('Yes')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                                Yes
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                                <input type="radio" name="poRequired" value="No" checked={poRequired === 'No'} onChange={() => setPoRequired('No')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    <Select label="Approval Limit" value={approvalLimit} onChange={e => setApprovalLimit(e.target.value)}>
                                        <option>$500</option>
                                        <option>$1000</option>
                                        <option>$2000</option>
                                        <option>$5000</option>
                                        <option>No Limit</option>
                                    </Select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tax Exempt?</label>
                                    <div className="flex items-center space-x-6">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="taxExempt" value="Yes" checked={taxExempt === 'Yes'} onChange={() => setTaxExempt('Yes')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            Yes
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="taxExempt" value="No" checked={taxExempt === 'No'} onChange={() => setTaxExempt('No')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            No
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {customerType === 'Property Manager' && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2">Property Manager Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Management Company Name" value={pmCompanyName} onChange={e => setPmCompanyName(e.target.value)} required />
                                    <Input label="Contact Person Name" value={pmContactName} onChange={e => setPmContactName(e.target.value)} required />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Phone" type="tel" placeholder="(210) 555-1234" value={pmPhone} onChange={e => setPmPhone(e.target.value)} required />
                                    <Input label="Email" type="email" placeholder="pm@domain.com" value={pmEmail} onChange={e => setPmEmail(e.target.value)} required />
                                </div>
                                <Input label="Service Address" placeholder="Start typing your address..." value={pmAddress} onChange={e => setPmAddress(e.target.value)} required />
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Is Owner Approval Required?</label>
                                    <div className="flex items-center space-x-6">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="ownerApprovalRequired" value="Yes" checked={ownerApprovalRequired === 'Yes'} onChange={() => setOwnerApprovalRequired('Yes')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            Yes
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="ownerApprovalRequired" value="No" checked={ownerApprovalRequired === 'No'} onChange={() => setOwnerApprovalRequired('No')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            No
                                        </label>
                                    </div>
                                </div>
                                
                                <Input label="Billing Contact Email" type="email" placeholder="ap@domain.com" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tax Exempt?</label>
                                    <div className="flex items-center space-x-6">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="taxExempt" value="Yes" checked={taxExempt === 'Yes'} onChange={() => setTaxExempt('Yes')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            Yes
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                            <input type="radio" name="taxExempt" value="No" checked={taxExempt === 'No'} onChange={() => setTaxExempt('No')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            No
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {customerType === 'General Contractor' && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2">General Contractor Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="GC Company Name" value={gcCompanyName} onChange={e => setGcCompanyName(e.target.value)} required />
                                    <Input label="Project Manager Name" value={gcContactName} onChange={e => setGcContactName(e.target.value)} required />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Phone" type="tel" placeholder="(210) 555-1234" value={gcPhone} onChange={e => setGcPhone(e.target.value)} required />
                                    <Input label="Email" type="email" placeholder="pm@gc-firm.com" value={gcEmail} onChange={e => setGcEmail(e.target.value)} required />
                                </div>
                                <Input label="Service Address" placeholder="Start typing your address..." value={gcAddress} onChange={e => setGcAddress(e.target.value)} required />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Job Name / Reference #" value={gcJobName} onChange={e => setGcJobName(e.target.value)} />
                                    <Input label="Billing/AP Email" type="email" placeholder="ap@gc-firm.com" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">PO Required?</label>
                                        <div className="flex items-center space-x-6">
                                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                                <input type="radio" name="poRequired" value="Yes" checked={poRequired === 'Yes'} onChange={() => setPoRequired('Yes')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                                Yes
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                                <input type="radio" name="poRequired" value="No" checked={poRequired === 'No'} onChange={() => setPoRequired('No')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                                No
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Tax Exempt?</label>
                                        <div className="flex items-center space-x-6">
                                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                                <input type="radio" name="taxExempt" value="Yes" checked={taxExempt === 'Yes'} onChange={() => setTaxExempt('Yes')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                                Yes
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-900 font-medium">
                                                <input type="radio" name="taxExempt" value="No" checked={taxExempt === 'No'} onChange={() => setTaxExempt('No')} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                                No
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2">Service Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Service Category" value={serviceCategory} onChange={e => setServiceCategory(e.target.value)}>
                                {serviceCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </Select>
                            <Select label="Job Type" value={jobType} onChange={e => setJobType(e.target.value)}>
                                {jobTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </Select>
                        </div>
                        <Textarea label="Issue Summary" value={issueSummary} onChange={e => setIssueSummary(e.target.value)} rows={3} placeholder="Please describe the issue or equipment needing service..." />

                        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2">Scheduling</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Preferred Date" type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} min={new Date().toISOString().split('T')[0]} required />
                            <Select label="Arrival Window" value={arrivalWindow} onChange={e => setArrivalWindow(e.target.value)}>
                                {arrivalWindows.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </Select>
                        </div>

                        {/* Custom File Upload Styling */}
                        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2">Extras</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upload a Photo (Optional)</label>
                                <div 
                                    onClick={() => document.getElementById('photo-input')?.click()}
                                    className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center gap-2 bg-slate-50 hover:bg-blue-50 hover:border-blue-500 transition-all cursor-pointer text-center"
                                >
                                    <UploadCloud className="w-7 h-7 text-slate-400" />
                                    <span className="text-xs font-bold text-blue-600">Choose File</span>
                                    <span className="text-[10px] text-slate-500">{photoFile ? photoFile.name : 'No file chosen'}</span>
                                    <input 
                                        id="photo-input"
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upload Tax Exempt Certificate (Optional)</label>
                                <div 
                                    onClick={() => document.getElementById('cert-input')?.click()}
                                    className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center gap-2 bg-slate-50 hover:bg-blue-50 hover:border-blue-500 transition-all cursor-pointer text-center"
                                >
                                    <UploadCloud className="w-7 h-7 text-slate-400" />
                                    <span className="text-xs font-bold text-blue-600">Choose File</span>
                                    <span className="text-[10px] text-slate-500">{taxExemptFile ? taxExemptFile.name : 'No file chosen'}</span>
                                    <input 
                                        id="cert-input"
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => setTaxExemptFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        </div>

                        <label className="flex items-start gap-2.5 text-xs text-blue-800 cursor-pointer bg-blue-50 border border-blue-100 p-3.5 rounded-xl">
                            <input type="checkbox" required className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500" />
                            <span>
                                By checking this box, you consent to receive SMS messages from {org?.name || 'TekTrakker'} regarding your service request. Message and data rates may apply. Message frequency varies. Reply STOP to opt-out or HELP for help. View our Privacy Policy at <a href={org?.website ? `${org.website}/privacy` : 'https://tektrakker.web.app/privacy'} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">{org?.website ? `${org.website}/privacy` : 'https://tektrakker.web.app/privacy'}</a>
                            </span>
                        </label>

                        <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-md font-bold mt-4" style={{ backgroundColor: brandColor }}>
                            {isSubmitting ? 'Submitting...' : 'Confirm Booking'}
                        </Button>
                    </form>
                </Card>
                
                <div className="text-center mt-8 flex flex-col items-center gap-2">
                    <a href="https://tektrakker.web.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                        Powered by 
                        <img src="/tektrakker-logo-web.png" alt="TekTrakker" className="h-4 ml-1.5 opacity-60 hover:opacity-100 transition-opacity" />
                    </a>
                    <span className="text-xs font-semibold text-slate-400">
                        Need Immediate 24/7 help? Call <a href="tel:2103184197" className="text-blue-600 hover:underline">(210) 318-4197</a>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default PublicBookingPage;
