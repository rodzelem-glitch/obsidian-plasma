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
import { CheckCircle } from 'lucide-react';

const PublicBookingPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const orgId = searchParams.get('oid');
    const [org, setOrg] = useState<Organization | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        serviceType: 'Repair',
        businessType: 'General',
        preferredDate: '',
        notes: '',
        isOwner: 'Yes',
        ownerName: '',
        ownerPhone: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const businessTypes = [
        'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'General', 'Cleaning',
        'Painting', 'Roofing', 'Contracting', 'Masonry', 'Telecommunications',
        'Solar', 'Security', 'Pet Grooming'
    ];

    useEffect(() => {
        const fetchOrg = async () => {
            if (orgId) {
                try {
                    const doc = await db.collection('organizations').doc(orgId).get();
                    if (doc.exists) {
                        const orgData = { ...doc.data(), id: doc.id } as Organization;
                        setOrg(orgData);
                        if (orgData.industry) {
                            setFormData(prev => ({ ...prev, businessType: orgData.industry || 'General' }));
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
                    console.warn("Could not fetch platform settings for mail", e);
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
            const appointment = {
                organizationId: targetOrgId || 'unaffiliated',
                customerName: formData.name,
                customerPhone: formData.phone,
                customerEmail: formData.email,
                address: formData.address,
                tasks: [formData.serviceType],
                appointmentTime: formData.preferredDate ? new Date(formData.preferredDate).toISOString() : new Date().toISOString(),
                status: 'Pending',
                source: 'PublicBooking',
                specialInstructions: formData.notes,
                businessType: formData.businessType,
                propertyOwner: {
                    isOwner: formData.isOwner,
                    ownerName: formData.ownerName,
                    ownerPhone: formData.ownerPhone
                },
                createdAt: new Date().toISOString(),
                marketingConsent: {
                    sms: true,
                    email: true,
                    agreedAt: new Date().toISOString(),
                    source: 'Widget'
                }
            };

            await db.collection('appointments').add(appointment);

            const toAddresses = [];
            if (orgId && org?.email) toAddresses.push(org.email);
            if (orgId && org?.notificationEmails) toAddresses.push(...org.notificationEmails);

            if (toAddresses.length === 0 || !orgId) toAddresses.push('platform@tektrakker.com');

            const subject = orgId ? `New Booking Request: ${formData.name}` : `[Find a Pro] New Lead: ${formData.name}`;

            const { notifyAdmins } = await import('lib/notificationService');
            await notifyAdmins(targetOrgId || 'platform', {
                title: "New Appointment Request",
                body: `${formData.name} requested a ${formData.serviceType} appointment.`,
                type: 'booking'
            });

            await db.collection('mail').add({
                to: toAddresses,
                cc: org?.email ? [org.email] : [], // Ensure the primary org email always gets a CC if not already in TO
                message: {
                    subject: subject,
                    text: `New booking request.\n\nCustomer: ${formData.name}\nPhone: ${formData.phone}\nService: ${formData.serviceType} (${formData.businessType})\nDate Requested: ${formData.preferredDate}\nAddress: ${formData.address}\n\nLog in to assign this customer.`,
                    html: `
                        <h2>New Service Request</h2>
                        <p><strong>Customer:</strong> ${formData.name}</p>
                        <p><strong>Phone:</strong> <a href="tel:${formData.phone}">${formData.phone}</a></p>
                        <p><strong>Email:</strong> ${formData.email}</p>
                        <p><strong>Address:</strong> ${formData.address}</p>
                        <hr/>
                        <p><strong>Trade Needed:</strong> ${formData.businessType}</p>
                        <p><strong>Service:</strong> ${formData.serviceType}</p>
                        <p><strong>Requested Date:</strong> ${formData.preferredDate}</p>
                        <p><strong>Notes:</strong> ${formData.notes}</p>
                        ${formData.isOwner === 'No' ? `<hr/>
                        <p><strong>Property Owner Name:</strong> ${formData.ownerName}</p>
                        <p><strong>Property Owner Phone:</strong> ${formData.ownerPhone}</p>` : ''}
                        <br/>
                        <a href="https://app.tektrakker.com" style="background:#0284c7;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Manage Request</a>
                    `
                },
                organizationId: targetOrgId || 'platform',
                type: 'BookingNotification',
                createdAt: new Date().toISOString(),
                // Only send transport if it is valid and fully configured
                ...(smtp?.host && smtp?.user ? {
                    transport: {
                        host: smtp.host,
                        port: Number(smtp.port),
                        auth: { user: smtp.user, pass: smtp.pass },
                        from: `"${smtp.fromName || org?.name}" <${smtp.fromEmail || org?.email || 'no-reply@tektrakker.com'}>`
                    }
                } : {})
            });

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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center py-10">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Received!</h2>
                    <p className="text-gray-600 mb-6">
                        Thank you, {formData.name}. We have received your request for {formData.serviceType}.<br/>
                        We will contact you shortly to confirm the appointment.
                    </p>
                    <Button onClick={() => window.location.reload()} variant="secondary">Book Another</Button>
                </Card>
            </div>
        );
    }

    const brandColor = org?.primaryColor || '#0284c7';

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans">
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-8">
                    {org?.logoUrl ? (
                         <img src={org.logoUrl} alt={org.name} className="h-16 mx-auto object-contain mb-4" />
                    ) : (
                         <h1 className="text-3xl font-bold text-gray-900 mb-2">{orgId ? org?.name : 'Find a Pro'}</h1>
                    )}
                    <p className="text-gray-500">Fill out the form below to request an appointment.</p>
                </div>

                <Card className="shadow-xl border-t-4" style={{ borderTopColor: brandColor }}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                            <Input label="Phone" type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
                        </div>
                        <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                        <Input label="Service Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Trade Needed" value={formData.businessType} onChange={e => setFormData({...formData, businessType: e.target.value})}>
                                {businessTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </Select>
                            <Select label="Service Type" value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value})}>
                                <option value="Repair">Repair</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Installation">New Installation</option>
                                <option value="Estimate">Estimate</option>
                            </Select>
                        </div>

                        <Input label="Preferred Date" type="date" value={formData.preferredDate} onChange={e => setFormData({...formData, preferredDate: e.target.value})} min={new Date().toISOString().split('T')[0]} required />

                        <fieldset>
                            <legend className="block text-sm font-medium text-gray-700">Are you the property owner?</legend>
                            <div className="flex items-center mt-2 space-x-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="isOwner" value="Yes" checked={formData.isOwner === 'Yes'} onChange={e => setFormData({...formData, isOwner: e.target.value})} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                                    <span className="text-gray-900 font-medium">Yes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="isOwner" value="No" checked={formData.isOwner === 'No'} onChange={e => setFormData({...formData, isOwner: e.target.value})} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                                    <span className="text-gray-900 font-medium">No</span>
                                </label>
                            </div>
                        </fieldset>

                        {formData.isOwner === 'No' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Owner's Name" value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} required />
                                <Input label="Owner's Phone" type="tel" value={formData.ownerPhone} onChange={e => setFormData({...formData, ownerPhone: e.target.value})} required />
                            </div>
                        )}

                        <Textarea label="Notes / Issues" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} placeholder="Describe the issue or any special instructions..." />

                        <label className="flex items-start gap-2 mt-2 p-3 bg-blue-50 rounded border border-blue-100 text-xs text-blue-800 cursor-pointer">
                             <input type="checkbox" required className="mt-0.5" />
                             <span>I agree to receive automated SMS/Email notifications regarding this request. Msg & data rates may apply.</span>
                        </label>

                        <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-lg font-bold mt-4" style={{ backgroundColor: brandColor }}>
                            {isSubmitting ? 'Submitting...' : 'Request Appointment'}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
        );
    };

export default PublicBookingPage;
