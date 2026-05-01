
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { DocumentTextIcon, BadgeIcon } from '@constants';
import type { IncidentReport } from 'types';
import { db } from 'lib/firebase';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import DOMPurify from 'dompurify';
import showToast from 'lib/toast';
import { uploadFileToStorage } from 'lib/storageService';
import { Camera, Upload, Trash2, FileText, CheckCircle2, BookOpen, ShieldAlert, Award, ArrowLeft, ChevronRight } from 'lucide-react';

const HRResources: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const location = useLocation();
    const [view, setView] = useState<'menu' | 'handbook' | 'safety' | 'certs'>('menu');
    const { currentUser: user } = state;

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'handbook' || tab === 'safety' || tab === 'certs') {
            setView(tab);
        } else {
            setView('menu');
        }
    }, [location.search]);

    // Safety Form State
    const [incidentType, setIncidentType] = useState<IncidentReport['type']>('Injury');
    const [incidentDesc, setIncidentDesc] = useState('');
    const [incidentAttachments, setIncidentAttachments] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Cert Upload State
    const [certFile, setCertFile] = useState<File | null>(null);
    const [certName, setCertName] = useState('');

    const policies = state.documents.filter(d => d.type === 'Policy');
    const myIncidents = state.incidentReports.filter(i => i.reporterId === user?.id);

    const handleSafetySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        try {
            const report: IncidentReport = {
                id: `inc-${Date.now()}`,
                organizationId: user.organizationId,
                reporterId: user.id,
                reporterName: `${user.firstName} ${user.lastName}`,
                date: new Date().toISOString(),
                type: incidentType,
                description: incidentDesc,
                status: 'Open',
                attachmentUrls: incidentAttachments
            };
            await db.collection('incidentReports').doc(report.id).set(report);
            dispatch({ type: 'ADD_INCIDENT', payload: report });
            setIncidentDesc('');
            setIncidentAttachments([]);
            showToast.success('Incident report submitted.');
        } catch (error) {
            console.error(error);
            showToast.error('Submission failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleIncidentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        try {
            const path = `organizations/${user.organizationId}/incidents/${Date.now()}_${file.name}`;
            const url = await uploadFileToStorage(path, file);
            setIncidentAttachments(prev => [...prev, url]);
            showToast.success('Photo attached.');
        } catch (error) {
            console.error(error);
            showToast.error('Upload failed.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCertificationUpload = async () => {
        if (!certFile || !certName || !user) {
            showToast.warn('Please provide both a name and a file.');
            return;
        }

        setIsUploading(true);
        try {
            const path = `organizations/${user.organizationId}/users/${user.id}/certs/${Date.now()}_${certFile.name}`;
            const url = await uploadFileToStorage(path, certFile);
            
            const newCert = {
                name: certName,
                expiryDate: null,
                fileUrl: url
            };

            const updatedCerts = [...(user.certifications || []), newCert];
            await db.collection('users').doc(user.id).update({
                certifications: updatedCerts
            });

            dispatch({ 
                type: 'UPDATE_USER', 
                payload: { ...user, certifications: updatedCerts } 
            });

            setCertFile(null);
            setCertName('');
            showToast.success('Certification uploaded successfully!');
        } catch (error) {
            console.error(error);
            showToast.error('Upload failed.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-24 max-w-7xl mx-auto">
            {view === 'menu' ? (
                <>
                    <header className="mb-8">
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">HR & Safety Resources</h1>
                        <p className="text-slate-500 mt-2">Select a category below to access policies, report incidents, or manage your certifications.</p>
                    </header>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <button onClick={() => setView('handbook')} className="group flex flex-col items-start p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:border-primary-500 transition-all hover:-translate-y-1 text-left">
                            <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <BookOpen size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Company Handbook</h2>
                            <p className="text-slate-500 text-sm mb-6 flex-1">Read official company policies, standard operating procedures, and HR guidelines.</p>
                            <div className="flex items-center text-primary-600 font-bold text-sm">
                                Open Handbook <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                            </div>
                        </button>

                        <button onClick={() => setView('safety')} className="group flex flex-col items-start p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:border-red-500 transition-all hover:-translate-y-1 text-left">
                            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <ShieldAlert size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Safety & Incidents</h2>
                            <p className="text-slate-500 text-sm mb-6 flex-1">Report workplace injuries, vehicle accidents, or property damage and view past reports.</p>
                            <div className="flex items-center text-red-600 font-bold text-sm">
                                Access Safety <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                            </div>
                        </button>

                        <button onClick={() => setView('certs')} className="group flex flex-col items-start p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:border-green-500 transition-all hover:-translate-y-1 text-left">
                            <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Award size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">My Certifications</h2>
                            <p className="text-slate-500 text-sm mb-6 flex-1">View your active credentials, EPA licenses, and upload new certifications for approval.</p>
                            <div className="flex items-center text-green-600 font-bold text-sm">
                                Manage Certs <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                            </div>
                        </button>
                    </div>
                </>
            ) : (
                <div className="mb-6">
                    <button onClick={() => setView('menu')} className="flex items-center text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors mb-6">
                        <ArrowLeft size={16} className="mr-2"/> Back to Resources
                    </button>
                    <header className="mb-6">
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                            {view === 'handbook' && 'Company Handbook & Policies'}
                            {view === 'safety' && 'Safety & Incident Reporting'}
                            {view === 'certs' && 'My Certifications'}
                        </h1>
                    </header>
                </div>
            )}

            {view === 'handbook' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {policies.length > 0 ? policies.map(doc => (
                        <Card key={doc.id} className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-primary-500">
                            <DocumentTextIcon className="w-8 h-8 text-gray-400 mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{doc.title}</h3>
                            <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-4" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(doc.content)}} />
                            <Button variant="secondary" className="text-xs">Read Full Policy</Button>
                        </Card>
                    )) : (
                        <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500">No policies or handbook documents available yet.</p>
                        </div>
                    )}
                </div>
            )}

            {view === 'safety' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">Report an Incident</h3>
                        <form onSubmit={handleSafetySubmit} className="space-y-4">
                            <Select label="Type" value={incidentType} onChange={e => setIncidentType(e.target.value as any)}>
                                <option value="Injury">Personal Injury</option>
                                <option value="Vehicle">Vehicle Accident</option>
                                <option value="Hazmat">Chemical / Hazmat</option>
                                <option value="Property Damage">Property Damage</option>
                                <option value="Other">Other</option>
                            </Select>
                            <Textarea 
                                label="Description" 
                                rows={5} 
                                value={incidentDesc} 
                                onChange={e => setIncidentDesc(e.target.value)} 
                                placeholder="Describe exactly what happened..." 
                                required 
                            />

                            <div className="space-y-2">
                                <label className="block text-sm font-black uppercase text-slate-400">Documentation / Photos</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {incidentAttachments.map((url, idx) => (
                                        <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                            <img src={url} alt="Incident Attachment" className="w-full h-full object-cover" />
                                            <button 
                                                type="button"
                                                title="Delete Attachment"
                                                aria-label="Delete Attachment"
                                                onClick={() => setIncidentAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                        <Camera className="text-slate-400 mb-1" size={24} />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Add Photo</span>
                                        <input type="file" accept="image/*" onChange={handleIncidentFileUpload} className="hidden" title="Add Photo" aria-label="Add Photo" />
                                    </label>
                                </div>
                            </div>

                            <Button type="submit" disabled={isSubmitting || isUploading} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 py-4 text-sm">
                                {isSubmitting ? 'Submitting Report...' : 'Submit Official Incident Report'}
                            </Button>
                        </form>
                    </Card>
                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">My Reports History</h3>
                        <div className="space-y-4">
                            {myIncidents.length > 0 ? myIncidents.map(inc => (
                                <div key={inc.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-red-600 dark:text-red-400 uppercase text-xs tracking-wider">{inc.type}</span>
                                        <span className="text-xs text-gray-500">{new Date(inc.date).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{inc.description}</p>
                                    <div className="text-xs font-medium">
                                        Status: <span className={inc.status === 'Resolved' ? 'text-green-600' : 'text-yellow-600'}>{inc.status}</span>
                                    </div>
                                    {inc.attachmentUrls && inc.attachmentUrls.length > 0 && (
                                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                                            {inc.attachmentUrls.map((url, idx) => (
                                                <img 
                                                    key={idx} 
                                                    src={url} 
                                                    alt="Evidence" 
                                                    className="w-12 h-12 object-cover rounded border border-slate-200 dark:border-slate-700 flex-shrink-0" 
                                                    onClick={() => window.open(url, '_blank')}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {inc.resolutionNotes && <p className="text-xs text-gray-500 mt-1 italic">Resolution: {inc.resolutionNotes}</p>}
                                </div>
                            )) : <p className="text-gray-500 text-sm">No incidents reported.</p>}
                        </div>
                    </Card>
                </div>
            )}

            {view === 'certs' && (
                <Card>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Active Certifications</h3>
                    <div className="space-y-4">
                        {user?.certifications && user.certifications.length > 0 ? user.certifications.map((cert, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <BadgeIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{cert.name}</p>
                                        <p className="text-xs text-gray-500">Expires: {cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {cert.fileUrl && (
                                        <button 
                                            onClick={() => window.open(cert.fileUrl, '_blank')}
                                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                            title="View Certificate"
                                        >
                                            <FileText size={18} />
                                        </button>
                                    )}
                                    <span className="bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                                        <CheckCircle2 size={12} /> Active
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-gray-500">No certifications recorded on profile.</p>
                        )}
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                            <h4 className="font-black text-xs uppercase text-slate-400 tracking-wider">Upload New Certification</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input 
                                    label="Certification Name" 
                                    placeholder="e.g. EPA Section 608" 
                                    value={certName}
                                    onChange={e => setCertName(e.target.value)}
                                />
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">File / Photo</label>
                                    <input 
                                        type="file" 
                                        title="Certification File Upload"
                                        aria-label="Certification File Upload"
                                        onChange={e => setCertFile(e.target.files?.[0] || null)}
                                        className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" 
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={handleCertificationUpload} 
                                disabled={isUploading || !certFile || !certName} 
                                className="w-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/20 py-4 text-sm"
                            >
                                {isUploading ? 'Uploading...' : 'Register Certification'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default HRResources;
