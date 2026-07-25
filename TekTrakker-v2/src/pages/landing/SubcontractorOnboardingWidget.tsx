import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { compressFile } from '../../lib/utils';
import { ALL_COMPLIANCE_DOCUMENTS, getDefaultComplianceSettings } from '../../lib/subcontractorCompliance';
import type { Organization, SubcontractorComplianceDoc } from '../../types';
import SignaturePad, { SignaturePadHandle } from '../../components/ui/SignaturePad';
import { ShieldCheck, Upload, CheckCircle, FileText, Building2, User, Mail, Phone, Wrench, CreditCard } from 'lucide-react';
import showToast from '../../lib/toast';

const SubcontractorOnboardingWidget: React.FC = () => {
    const { orgId } = useParams<{ orgId: string }>();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form fields
    const [name, setName] = useState('');
    const [contactName, setContactName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [trade, setTrade] = useState('HVAC');
    const [taxId, setTaxId] = useState('');
    const [address, setAddress] = useState('');

    // Document uploads state
    const [uploadedDocs, setUploadedDocs] = useState<Record<string, { fileName: string; fileUrl: string; expiryDate?: string }>>({});
    const [signature, setSignature] = useState('');

    const sigPadRef = useRef<SignaturePadHandle>(null);

    useEffect(() => {
        const fetchOrg = async () => {
            if (!orgId) {
                setLoading(false);
                return;
            }
            try {
                const orgDoc = await db.collection('organizations').doc(orgId).get();
                if (orgDoc.exists) {
                    setOrganization({ ...orgDoc.data(), id: orgDoc.id } as Organization);
                }
            } catch (err) {
                console.error("Error fetching organization for widget:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrg();
    }, [orgId]);

    const settings = organization?.subcontractorComplianceSettings || getDefaultComplianceSettings();
    const requiredDocsMap = settings.requiredDocuments || {};

    // Filter documents required for this organization
    const activeDocDefs = ALL_COMPLIANCE_DOCUMENTS.filter(def => requiredDocsMap[def.key] ?? def.defaultRequired);

    const handleFileUpload = async (docKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await compressFile(file, 0.8);
            setUploadedDocs(prev => ({
                ...prev,
                [docKey]: {
                    fileName: file.name,
                    fileUrl: dataUrl,
                    expiryDate: prev[docKey]?.expiryDate || ''
                }
            }));
            showToast.success(`Uploaded ${file.name}`);
        } catch (err) {
            console.error("File upload error:", err);
            showToast.error("Failed to process file upload.");
        }
    };

    const handleExpiryChange = (docKey: string, expiryDate: string) => {
        setUploadedDocs(prev => ({
            ...prev,
            [docKey]: {
                fileName: prev[docKey]?.fileName || '',
                fileUrl: prev[docKey]?.fileUrl || '',
                expiryDate
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !contactName.trim() || !email.trim()) {
            showToast.warn("Please complete all required contact fields.");
            return;
        }

        // Validate signature if required
        let capturedSig = signature;
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            capturedSig = sigPadRef.current.toDataURL();
        }

        setSubmitting(true);
        try {
            // Build complianceDocs array
            const complianceDocs: SubcontractorComplianceDoc[] = activeDocDefs.map(def => {
                const uploaded = uploadedDocs[def.key];
                return {
                    id: `doc-${def.key}-${Date.now()}`,
                    docKey: def.key,
                    label: def.label,
                    category: def.category,
                    fileUrl: uploaded?.fileUrl || '',
                    fileName: uploaded?.fileName || '',
                    uploadedAt: uploaded?.fileUrl ? new Date().toISOString() : undefined,
                    expiryDate: uploaded?.expiryDate || undefined,
                    status: uploaded?.fileUrl ? 'pending_review' : 'missing'
                };
            });

            const newSubId = `sub-${Date.now()}`;
            const subData = {
                id: newSubId,
                organizationId: orgId,
                name: name.trim(),
                contactName: contactName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
                trade: trade.trim(),
                taxId: taxId.trim(),
                address: address.trim(),
                status: 'pending_review',
                complianceDocs,
                signature: capturedSig || null,
                signedDate: capturedSig ? new Date().toISOString() : null,
                createdAt: new Date().toISOString()
            };

            // Save to subcontractors collection
            await db.collection('subcontractors').doc(newSubId).set(subData);

            // Queue notification for org admins
            try {
                const orgEmail = organization?.email || 'noreply@tektrakker.com';
                await db.collection('mail_queue').add({
                    to: orgEmail,
                    message: {
                        subject: `New Subcontractor Registration: ${name.trim()}`,
                        html: `<div style="font-family:sans-serif;padding:20px;"><h2 style="color:#2563eb;">New Subcontractor Onboarding Submission</h2><p><strong>Company:</strong> ${name.trim()}</p><p><strong>Contact:</strong> ${contactName.trim()} (${email.trim()})</p><p><strong>Trade:</strong> ${trade}</p><p>Please log in to TekTrakker Workforce -> Subcontractors to review compliance documents.</p></div>`,
                        text: `New Subcontractor Onboarding Submission from ${name.trim()} (${contactName.trim()}).`
                    },
                    organizationId: orgId,
                    type: 'SubcontractorOnboarding',
                    createdAt: new Date().toISOString()
                });
            } catch (mailErr) {
                console.warn("Mail queue alert warning:", mailErr);
            }

            setSubmitted(true);
            showToast.success("Subcontractor setup form submitted successfully!");
        } catch (err: any) {
            console.error("Error submitting subcontractor setup:", err);
            showToast.error("Failed to submit registration. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 font-sans">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="w-full max-w-2xl mx-auto p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center font-sans">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={36} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Registration Submitted!</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                    Thank you <strong>{contactName}</strong>. Your subcontractor setup form and compliance documents have been submitted to <strong>{organization?.name || 'the service provider'}</strong> for review.
                </p>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs text-slate-500">
                    You will be notified once your vendor profile and direct deposit details are verified.
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto p-4 md:p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 font-sans text-slate-900 dark:text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
                        <ShieldCheck size={16} /> Subcontractor Setup &amp; Onboarding
                    </div>
                    <h1 className="text-xl md:text-2xl font-black">{organization?.name || 'Vendor Setup Portal'}</h1>
                </div>
                {organization?.logo && (
                    <img src={organization.logo} alt={organization.name} className="h-10 w-auto object-contain" />
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company & Contact Details */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <Building2 size={18} className="text-blue-500" /> 1. Subcontractor Contact Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <label className="block font-bold text-xs mb-1 text-slate-700 dark:text-slate-300">Company / Business Name *</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Apex Mechanical LLC"
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-xs mb-1 text-slate-700 dark:text-slate-300">Primary Contact Name *</label>
                            <input
                                type="text"
                                required
                                value={contactName}
                                onChange={e => setContactName(e.target.value)}
                                placeholder="e.g. John Doe"
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-xs mb-1 text-slate-700 dark:text-slate-300">Email Address *</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="john@apexmechanical.com"
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-xs mb-1 text-slate-700 dark:text-slate-300">Phone Number *</label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="(555) 000-0000"
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-xs mb-1 text-slate-700 dark:text-slate-300">Trade / Specialty *</label>
                            <select
                                value={trade}
                                onChange={e => setTrade(e.target.value)}
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="HVAC">HVAC &amp; Mechanical</option>
                                <option value="Electrical">Electrical</option>
                                <option value="Plumbing">Plumbing</option>
                                <option value="Roofing">Roofing</option>
                                <option value="General Contracting">General Contracting</option>
                                <option value="Landscaping">Landscaping</option>
                                <option value="Appliance Repair">Appliance Repair</option>
                                <option value="Other">Other Trade</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-bold text-xs mb-1 text-slate-700 dark:text-slate-300">Federal Tax ID / EIN</label>
                            <input
                                type="text"
                                value={taxId}
                                onChange={e => setTaxId(e.target.value)}
                                placeholder="XX-XXXXXXX"
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block font-bold text-xs mb-1 text-slate-700 dark:text-slate-300">Business Address</label>
                            <input
                                type="text"
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder="123 Main St, City, State ZIP"
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Required Compliance Documents */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-500" /> 2. Required Compliance &amp; Payout Documents
                    </h3>

                    <div className="space-y-4">
                        {activeDocDefs.map((def) => {
                            const uploaded = uploadedDocs[def.key];
                            return (
                                <div key={def.key} className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 font-bold text-sm">
                                            {def.key === 'direct_deposit' ? <CreditCard size={16} className="text-emerald-500" /> : <FileText size={16} className="text-slate-400" />}
                                            {def.label}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{def.description}</p>
                                        {uploaded?.fileName && (
                                            <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle size={14} /> Attached: {uploaded.fileName}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {(def.key === 'insurance_coi' || def.key === 'trade_license') && (
                                            <input
                                                type="date"
                                                title="Expiration Date"
                                                value={uploaded?.expiryDate || ''}
                                                onChange={e => handleExpiryChange(def.key, e.target.value)}
                                                className="p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                                            />
                                        )}
                                        <label className="cursor-pointer py-2 px-4 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors">
                                            <Upload size={14} /> {uploaded?.fileName ? 'Change File' : 'Upload Document'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={e => handleFileUpload(def.key, e)}
                                            />
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Signature Authorization */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                        3. Digital Signature Authorization
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        By signing below, I certify that all information and documents provided are accurate and authorized for vendor onboarding.
                    </p>
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden">
                        <SignaturePad ref={sigPadRef} />
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {submitting ? 'Submitting Registration...' : 'Complete & Submit Onboarding Form'}
                </button>

                <div className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    Powered by TekTrakker Contractor Management
                </div>
            </form>
        </div>
    );
};

export default SubcontractorOnboardingWidget;
