
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from 'lib/firebase';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import { BriefcaseIcon, Upload, CheckCircle } from 'lucide-react';
import type { Applicant } from 'types';

const compressFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const result = event.target?.result as string;
            // If PDF, just return base64 (cannot canvas resize PDF in browser easily without libs)
            if (file.type === 'application/pdf') {
                resolve(result);
                return;
            }
            // If Image, compress
            if (file.type.startsWith('image/')) {
                const img = new Image();
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
                img.onerror = () => resolve(result);
            } else {
                resolve(result); // Fallback
            }
        };
        reader.onerror = reject;
    });
};

const PublicCareerPage: React.FC = () => {
    const { orgId } = useParams<{ orgId: string }>();
    const [orgName, setOrgName] = useState('Service Provider');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [resumeFile, setResumeFile] = useState<File | null>(null);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        position: 'HVAC Technician',
        experienceYears: '',
    });

    useEffect(() => {
        const fetchOrg = async () => {
            if (orgId) {
                try {
                    const doc = await db.collection('organizations').doc(orgId).get();
                    if (doc.exists) {
                        setOrgName(doc.data()?.name || 'Service Provider');
                    }
                } catch (e) {
                    console.warn("Could not fetch org details", e);
                }
            }
        };
        fetchOrg();
    }, [orgId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId) return;
        setLoading(true);

        try {
            let resumeDataUrl = '';
            if (resumeFile) {
                if (resumeFile.size > 1024 * 1024 * 1) { // 1MB Limit
                    alert("File too large. Max 1MB.");
                    setLoading(false);
                    return;
                }
                resumeDataUrl = await compressFile(resumeFile);
            }

            const applicant: Applicant = {
                id: `app-${Date.now()}`,
                organizationId: orgId,
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone,
                position: formData.position,
                experienceYears: Number(formData.experienceYears) || 0,
                resumeDataUrl,
                resumeFileName: resumeFile?.name,
                status: 'New',
                appliedDate: new Date().toISOString()
            };

            await db.collection('applicants').doc(applicant.id).set(applicant);

            // Notify Admin
            await db.collection('messages').add({
                organizationId: orgId,
                senderId: 'system-applicant',
                receiverId: 'all', // Broadcast to admins
                content: `New Job Applicant: ${applicant.firstName} ${applicant.lastName} for ${applicant.position}`,
                timestamp: new Date().toISOString(),
                read: false,
                type: 'alert'
            });

            setSuccess(true);
        } catch (error) {
            console.error(error);
            alert("Application failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center py-10">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Received</h2>
                    <p className="text-gray-600 mb-6">
                        Thank you for applying to <strong>{orgName}</strong>.<br/>
                        Our team will review your information and contact you soon.
                    </p>
                    <Button onClick={() => window.location.reload()} variant="secondary">Back to Form</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans">
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary-600">{orgName} Careers</h1>
                    <p className="text-gray-500 mt-2">We are looking for dedicated professionals to join our team.</p>
                </div>

                <Card className="shadow-xl border-t-4 border-primary-500">
                    <div className="mb-6 flex items-center gap-2 text-primary-700 font-semibold bg-primary-50 p-3 rounded">
                        <BriefcaseIcon size={20} />
                        Apply Now
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
                            <Input label="Last Name" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required />
                        </div>
                        <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
                        <Input label="Phone" type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Position" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})}>
                                <option value="HVAC Technician">HVAC Technician</option>
                                <option value="Installer">Installer</option>
                                <option value="Helper">Helper / Apprentice</option>
                                <option value="Office Staff">Office Staff</option>
                                <option value="Sales">Sales</option>
                            </Select>
                            <Input label="Years Experience" type="number" value={formData.experienceYears} onChange={e => setFormData({...formData, experienceYears: e.target.value})} required />
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Resume (PDF or Image)</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                                <input 
                                    type="file" 
                                    accept="image/*,application/pdf"
                                    onChange={e => setResumeFile(e.target.files ? e.target.files[0] : null)}
                                    className="hidden"
                                    id="resume-upload"
                                />
                                <label htmlFor="resume-upload" className="cursor-pointer flex flex-col items-center">
                                    <Upload className="text-gray-400 mb-2" size={24} />
                                    <span className="text-sm text-primary-600 font-bold">{resumeFile ? resumeFile.name : 'Click to Upload'}</span>
                                    <span className="text-xs text-gray-400 mt-1">Max 1MB</span>
                                </label>
                            </div>
                        </div>

                        <Button type="submit" disabled={loading} className="w-full mt-4">
                            {loading ? 'Submitting...' : 'Submit Application'}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default PublicCareerPage;
