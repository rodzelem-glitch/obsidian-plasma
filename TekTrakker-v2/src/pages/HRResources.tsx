import { cleanUndefinedFields } from '../lib/utils';

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { BadgeIcon } from '@constants';
import type { IncidentReport, User } from 'types';
import { db } from 'lib/firebase';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Textarea from 'components/ui/Textarea';
import showToast from 'lib/toast';
import { uploadFileToStorage } from 'lib/storageService';
import { Camera, Upload, Trash2, FileText, CheckCircle2, BookOpen, ShieldAlert, Award, ArrowLeft, ChevronRight, ClipboardList, Download, ExternalLink } from 'lucide-react';
import HRHandbookView from './admin/compliance/components/HRHandbookView';
import Modal from 'components/ui/Modal';

const HRResources: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const location = useLocation();
    const [view, setView] = useState<'menu' | 'handbook' | 'safety' | 'certs' | 'onboarding'>('menu');
    const { currentUser: user } = state;
    const { t } = useLanguage();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab === 'handbook' || tab === 'safety' || tab === 'certs' || tab === 'onboarding') {
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

    // Onboarding Steps State
    const [activeModalStep, setActiveModalStep] = useState<string | null>(null);
    const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
    const [directDepositPref, setDirectDepositPref] = useState('');
    const [onboardingFile, setOnboardingFile] = useState<File | null>(null);
    const [sensitiveData, setSensitiveData] = useState<any>(null);

    useEffect(() => {
        if (!user?.id) return;
        const fetchSensitive = async () => {
            try {
                const doc = await db.collection('users').doc(user.id).collection('private').doc('sensitive').get();
                if (doc.exists) {
                    setSensitiveData(doc.data());
                }
            } catch (err) {
                console.error("Failed to load employee sensitive onboarding data:", err);
            }
        };
        fetchSensitive();
    }, [user?.id]);

    useEffect(() => {
        if (sensitiveData?.directDeposit?.preference) {
            setDirectDepositPref(sensitiveData.directDeposit.preference);
        }
    }, [sensitiveData]);

    const myIncidents = state.incidentReports.filter(i => i.reporterId === user?.id);

    const handleStartStep = (stepId: string) => {
        if (stepId === 'handbookSigned') {
            setView('handbook');
        } else {
            setActiveModalStep(stepId);
            setOnboardingFile(null);
        }
    };

    const handleOnboardingFileUpload = async (stepId: string) => {
        if (!user || !onboardingFile) {
            showToast.warn(t('Please select a file to upload.'));
            return;
        }
        setUploadingStepId(stepId);
        try {
            const timestamp = Date.now();
            const ext = onboardingFile.name.split('.').pop();
            const path = `organizations/${user.organizationId}/users/${user.id}/onboarding/${stepId}-${timestamp}.${ext}`;
            const url = await uploadFileToStorage(path, onboardingFile);

            const formIdMap: Record<string, string> = {
                'w4Completed': 'federal-w4',
                'i9Completed': 'federal-i9',
                'idUploaded': 'government-id'
            };
            const formId = formIdMap[stepId] || stepId;

            const updatedSubmissions = {
                ...(sensitiveData?.formSubmissions || {}),
                [formId]: {
                    timestamp: new Date().toISOString(),
                    fileUrl: url,
                    fileName: onboardingFile.name
                }
            };

            const updatedHiringPacketStatus = {
                ...(user.hiringPacketStatus || {}),
                [stepId]: true
            };

            // Save sensitive documents to the private subcollection
            await db.collection('users').doc(user.id).collection('private').doc('sensitive').set(cleanUndefinedFields({
                formSubmissions: updatedSubmissions
            }), { merge: true });

            // Update status on the public user profile document
            await db.collection('users').doc(user.id).update(cleanUndefinedFields({
                hiringPacketStatus: updatedHiringPacketStatus
            }));

            setSensitiveData(prev => ({
                ...prev,
                formSubmissions: updatedSubmissions
            }));

            dispatch({
                type: 'UPDATE_EMPLOYEE',
                payload: {
                    id: user.id,
                    formSubmissions: updatedSubmissions,
                    hiringPacketStatus: updatedHiringPacketStatus
                } as any
            });

            showToast.success(t('Document uploaded successfully!'));
            setOnboardingFile(null);
            setActiveModalStep(null);
        } catch (error) {
            console.error(error);
            showToast.error(t('Upload failed.'));
        } finally {
            setUploadingStepId(null);
        }
    };

    const handleSaveDirectDeposit = async () => {
        if (!user || !directDepositPref) {
            showToast.warn(t('Please select a preference.'));
            return;
        }
        try {
            const updatedDirectDeposit = {
                ...(sensitiveData?.directDeposit || {}),
                preference: directDepositPref
            };
            const updatedHiringPacketStatus = {
                ...(user.hiringPacketStatus || {}),
                directDepositCompleted: true
            };

            // Save sensitive deposit info to the private subcollection
            await db.collection('users').doc(user.id).collection('private').doc('sensitive').set(cleanUndefinedFields({
                directDeposit: updatedDirectDeposit
            }), { merge: true });

            // Update status on the public user profile document
            await db.collection('users').doc(user.id).update(cleanUndefinedFields({
                hiringPacketStatus: updatedHiringPacketStatus
            }));

            setSensitiveData(prev => ({
                ...prev,
                directDeposit: updatedDirectDeposit
            }));

            dispatch({
                type: 'UPDATE_EMPLOYEE',
                payload: {
                    id: user.id,
                    directDeposit: updatedDirectDeposit,
                    hiringPacketStatus: updatedHiringPacketStatus
                } as any
            });

            showToast.success(t('Direct deposit preference saved!'));
            setActiveModalStep(null);
        } catch (error) {
            console.error(error);
            showToast.error(t('Failed to save preference.'));
        }
    };

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
            await db.collection('incidentReports').doc(report.id).set(cleanUndefinedFields(report));
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
            await db.collection('users').doc(user.id).update(cleanUndefinedFields({
                certifications: updatedCerts
            }));

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
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t("HR & Safety Resources")}</h1>
                        <p className="text-slate-500 mt-2">{t("Select a category below to access policies, report incidents, or manage your certifications.")}</p>
                    </header>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <button onClick={() => setView('handbook')} className="group flex flex-col items-start p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:border-primary-500 transition-all hover:-translate-y-1 text-left">
                            <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <BookOpen size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("Company Handbook")}</h2>
                            <p className="text-slate-500 text-sm mb-6 flex-1">{t("Read official company policies, standard operating procedures, and HR guidelines.")}</p>
                            <div className="flex items-center text-primary-600 font-bold text-sm">
                                {t("Open Handbook")} <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                            </div>
                        </button>

                        <button onClick={() => setView('safety')} className="group flex flex-col items-start p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:border-red-500 transition-all hover:-translate-y-1 text-left">
                            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <ShieldAlert size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("Safety & Incidents")}</h2>
                            <p className="text-slate-500 text-sm mb-6 flex-1">{t("Report workplace injuries, vehicle accidents, or property damage and view past reports.")}</p>
                            <div className="flex items-center text-red-600 font-bold text-sm">
                                {t("Access Safety")} <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                            </div>
                        </button>

                        <button onClick={() => setView('certs')} className="group flex flex-col items-start p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:border-green-500 transition-all hover:-translate-y-1 text-left">
                            <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Award size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("My Certifications")}</h2>
                            <p className="text-slate-500 text-sm mb-6 flex-1">{t("View your active credentials, EPA licenses, and upload new certifications for approval.")}</p>
                            <div className="flex items-center text-green-600 font-bold text-sm">
                                {t("Manage Certs")} <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                            </div>
                        </button>
                        <button onClick={() => setView('onboarding')} className="group flex flex-col items-start p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 hover:border-blue-500 transition-all hover:-translate-y-1 text-left">
                            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <ClipboardList size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t("Hiring Packet")}</h2>
                            <p className="text-slate-500 text-sm mb-6 flex-1">{t("Complete your new hire onboarding packet, including W-4, direct deposit, and policy signatures.")}</p>
                            <div className="flex items-center text-blue-600 font-bold text-sm">
                                {t("View Packet")} <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                            </div>
                        </button>
                    </div>
                </>
            ) : (
                <div className="mb-6">
                    <button onClick={() => setView('menu')} className="flex items-center text-sm font-bold text-slate-500 hover:text-primary-600 transition-colors mb-6">
                        <ArrowLeft size={16} className="mr-2"/> {t("Back to Resources")}
                    </button>
                    <header className="mb-6">
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                            {view === 'handbook' && t('Company Handbook & Policies')}
                            {view === 'safety' && t('Safety & Incident Reporting')}
                            {view === 'certs' && t('My Certifications')}
                            {view === 'onboarding' && t('Hiring & Onboarding Packet')}
                        </h1>
                    </header>
                </div>
            )}

            {view === 'handbook' && (
                <Card className="p-6">
                    <HRHandbookView employee={user as User} isSelf={true} />
                </Card>
            )}

            {view === 'safety' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">{t("Report an Incident")}</h3>
                        <form onSubmit={handleSafetySubmit} className="space-y-4">
                            <Select label={t("Type")} value={incidentType} onChange={e => setIncidentType(e.target.value as any)}>
                                <option value="Injury">{t("Personal Injury")}</option>
                                <option value="Vehicle">{t("Vehicle Accident")}</option>
                                <option value="Hazmat">{t("Chemical / Hazmat")}</option>
                                <option value="Property Damage">{t("Property Damage")}</option>
                                <option value="Other">{t("Other")}</option>
                            </Select>
                            <Textarea 
                                label={t("Description")} 
                                rows={5} 
                                value={incidentDesc} 
                                onChange={e => setIncidentDesc(e.target.value)} 
                                placeholder={t("Describe exactly what happened...")} 
                                required 
                            />

                            <div className="space-y-2">
                                <label className="block text-sm font-black uppercase text-slate-400">{t("Documentation / Photos")}</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {incidentAttachments.map((url, idx) => (
                                        <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                            <img src={url} alt="Incident Attachment" className="w-full h-full object-cover" />
                                            <button 
                                                type="button"
                                                title={t("Delete Attachment")}
                                                aria-label={t("Delete Attachment")}
                                                onClick={() => setIncidentAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                        <Camera className="text-slate-400 mb-1" size={24} />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{t("Add Photo")}</span>
                                        <input type="file" accept="image/*" onChange={handleIncidentFileUpload} className="hidden" title={t("Add Photo")} aria-label={t("Add Photo")} />
                                    </label>
                                </div>
                            </div>

                            <Button type="submit" disabled={isSubmitting || isUploading} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 py-4 text-sm">
                                {isSubmitting ? t('Submitting Report...') : t('Submit Official Incident Report')}
                            </Button>
                        </form>
                    </Card>
                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t("My Reports History")}</h3>
                        <div className="space-y-4">
                            {myIncidents.length > 0 ? myIncidents.map(inc => (
                                <div key={inc.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-red-600 dark:text-red-400 uppercase text-xs tracking-wider">{t(inc.type)}</span>
                                        <span className="text-xs text-gray-500">{new Date(inc.date).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{inc.description}</p>
                                    <div className="text-xs font-medium">
                                        {t("Status")}: <span className={inc.status === 'Resolved' ? 'text-green-600' : 'text-yellow-600'}>{t(inc.status)}</span>
                                    </div>
                                    {inc.attachmentUrls && inc.attachmentUrls.length > 0 && (
                                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                                            {inc.attachmentUrls.map((url, idx) => (
                                                <a 
                                                    key={idx} 
                                                    href={url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="flex-shrink-0"
                                                >
                                                    <img 
                                                        src={url} 
                                                        alt="Evidence" 
                                                        className="w-12 h-12 object-cover rounded border border-slate-200 dark:border-slate-700" 
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {inc.resolutionNotes && <p className="text-xs text-gray-500 mt-1 italic">{t("Resolution")}: {inc.resolutionNotes}</p>}
                                </div>
                            )) : <p className="text-gray-500 text-sm">{t("No incidents reported.")}</p>}
                        </div>
                    </Card>
                </div>
            )}

            {view === 'certs' && (
                <Card>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t("Active Certifications")}</h3>
                    <div className="space-y-4">
                        {user?.certifications && user.certifications.length > 0 ? user.certifications.map((cert, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <BadgeIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{cert.name}</p>
                                        <p className="text-xs text-gray-500">{t("Expires:")} {cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : t('N/A')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {cert.fileUrl && (
                                        <button 
                                            onClick={() => window.open(cert.fileUrl, '_blank')}
                                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                            title={t("View Certificate")}
                                        >
                                            <FileText size={18} />
                                        </button>
                                    )}
                                    <span className="bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                                        <CheckCircle2 size={12} /> {t("Active")}
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-gray-500">{t("No certifications recorded on profile.")}</p>
                        )}
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                            <h4 className="font-black text-xs uppercase text-slate-400 tracking-wider">{t("Upload New Certification")}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input 
                                    label={t("Certification Name")} 
                                    placeholder="e.g. EPA Section 608" 
                                    value={certName}
                                    onChange={e => setCertName(e.target.value)}
                                />
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("File / Photo")}</label>
                                    <input 
                                        type="file" 
                                        title={t("Certification File Upload")}
                                        aria-label={t("Certification File Upload")}
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
                                {isUploading ? t('Uploading...') : t('Register Certification')}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {view === 'onboarding' && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t("New Hire Packet")}</h3>
                                <p className="text-gray-500 mt-1">{t("Please complete all required steps to finalize your onboarding.")}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-3xl font-black text-primary-600">
                                    {[user?.hiringPacketStatus?.w4Completed, user?.hiringPacketStatus?.i9Completed, user?.hiringPacketStatus?.directDepositCompleted, user?.hiringPacketStatus?.handbookSigned, user?.hiringPacketStatus?.idUploaded].filter(Boolean).length}
                                </span>
                                <span className="text-slate-400 font-bold"> / 5</span>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{t("Completed")}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {[
                                { id: 'w4Completed', title: 'W-4 Tax Withholding', desc: 'Complete your federal tax withholding information.', status: user?.hiringPacketStatus?.w4Completed },
                                { id: 'i9Completed', title: 'I-9 Employment Eligibility', desc: 'Verify your eligibility to work in the United States.', status: user?.hiringPacketStatus?.i9Completed },
                                { id: 'directDepositCompleted', title: 'Direct Deposit Setup', desc: 'Provide your banking details for payroll.', status: user?.hiringPacketStatus?.directDepositCompleted },
                                { id: 'handbookSigned', title: 'Employee Handbook Acknowledgment', desc: 'Read and sign the company policies and handbook.', status: user?.hiringPacketStatus?.handbookSigned },
                                { id: 'idUploaded', title: 'Government ID Upload', desc: 'Provide a clear copy of your driver\'s license or state ID.', status: user?.hiringPacketStatus?.idUploaded },
                            ].map(step => (
                                <div key={step.id} className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${step.status ? 'border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                                    <div className="flex gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${step.status ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                            {step.status ? <CheckCircle2 size={20} /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />}
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-lg ${step.status ? 'text-green-900 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>{t(step.title)}</h4>
                                            <p className={`text-sm ${step.status ? 'text-green-700 dark:text-green-600' : 'text-slate-500'}`}>{t(step.desc)}</p>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-auto flex-shrink-0">
                                        <Button 
                                            variant={step.status ? 'secondary' : 'primary'} 
                                            className="w-full sm:w-auto"
                                            onClick={() => handleStartStep(step.id)}
                                        >
                                            {step.status ? t('Review') : t('Start')}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <Button 
                                className="w-full py-4 text-lg shadow-lg shadow-primary-500/20"
                                disabled={!user?.hiringPacketStatus?.w4Completed || !user?.hiringPacketStatus?.i9Completed || !user?.hiringPacketStatus?.directDepositCompleted || !user?.hiringPacketStatus?.handbookSigned || !user?.hiringPacketStatus?.idUploaded}
                                onClick={() => showToast.success(t("Hiring packet submitted successfully to HR!"))}
                            >
                                {t("Submit Final Hiring Packet")}
                            </Button>
                            <p className="text-center text-xs text-slate-500 mt-4">{t("You must complete all steps before final submission to HR.")}</p>
                        </div>
                    </Card>
                </div>
            )}

            {activeModalStep && (
                <Modal 
                    isOpen={true} 
                    onClose={() => { setActiveModalStep(null); setOnboardingFile(null); }} 
                    title={
                        activeModalStep === 'w4Completed' ? t("IRS Form W-4 Tax Withholding") :
                        activeModalStep === 'i9Completed' ? t("USCIS Form I-9 Work Eligibility") :
                        activeModalStep === 'directDepositCompleted' ? t("Direct Deposit Configuration") :
                        activeModalStep === 'idUploaded' ? t("Government ID Verification") : ""
                    }
                >
                    <div className="space-y-6">
                        {activeModalStep === 'w4Completed' && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    {t("Download the official IRS Form W-4, fill it out, and upload the completed version below to configure your tax withholding.")}
                                </p>
                                <div className="flex gap-3">
                                    <a 
                                        href="https://www.irs.gov/pub/irs-pdf/fw4.pdf" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all border border-blue-200"
                                    >
                                        <Download size={14} /> {t("Download Blank W-4 PDF")}
                                    </a>
                                </div>
                                {sensitiveData?.formSubmissions?.['federal-w4']?.fileUrl && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between text-xs text-green-700 font-semibold mt-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-green-500" />
                                            <span>{t("Uploaded:")} {sensitiveData.formSubmissions['federal-w4'].fileName}</span>
                                        </div>
                                        <a href={sensitiveData.formSubmissions['federal-w4'].fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline flex items-center gap-1">
                                            <ExternalLink size={12} /> {t("View")}
                                        </a>
                                    </div>
                                )}
                                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center">
                                    <label className="cursor-pointer block space-y-2">
                                        <Upload className="mx-auto text-slate-400" size={24} />
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                            {onboardingFile ? onboardingFile.name : t("Select Completed W-4 File")}
                                        </span>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg" 
                                            className="hidden" 
                                            onChange={e => setOnboardingFile(e.target.files?.[0] || null)} 
                                        />
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Button variant="secondary" onClick={() => { setActiveModalStep(null); setOnboardingFile(null); }}>
                                        {t("Cancel")}
                                    </Button>
                                    <Button 
                                        onClick={() => handleOnboardingFileUpload('w4Completed')} 
                                        disabled={!onboardingFile || uploadingStepId === 'w4Completed'}
                                    >
                                        {uploadingStepId === 'w4Completed' ? t("Uploading...") : t("Submit Document")}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeModalStep === 'i9Completed' && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    {t("Download USCIS Form I-9, complete it, and upload it below to verify work eligibility in the United States.")}
                                </p>
                                <div className="flex gap-3">
                                    <a 
                                        href="https://www.uscis.gov/sites/default/files/document/forms/i-9-paper-version.pdf" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all border border-blue-200"
                                    >
                                        <Download size={14} /> {t("Download Blank I-9 PDF")}
                                    </a>
                                </div>
                                {sensitiveData?.formSubmissions?.['federal-i9']?.fileUrl && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between text-xs text-green-700 font-semibold mt-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-green-500" />
                                            <span>{t("Uploaded:")} {sensitiveData.formSubmissions['federal-i9'].fileName}</span>
                                        </div>
                                        <a href={sensitiveData.formSubmissions['federal-i9'].fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline flex items-center gap-1">
                                            <ExternalLink size={12} /> {t("View")}
                                        </a>
                                    </div>
                                )}
                                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center">
                                    <label className="cursor-pointer block space-y-2">
                                        <Upload className="mx-auto text-slate-400" size={24} />
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                            {onboardingFile ? onboardingFile.name : t("Select Completed I-9 File")}
                                        </span>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg" 
                                            className="hidden" 
                                            onChange={e => setOnboardingFile(e.target.files?.[0] || null)} 
                                        />
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Button variant="secondary" onClick={() => { setActiveModalStep(null); setOnboardingFile(null); }}>
                                        {t("Cancel")}
                                    </Button>
                                    <Button 
                                        onClick={() => handleOnboardingFileUpload('i9Completed')} 
                                        disabled={!onboardingFile || uploadingStepId === 'i9Completed'}
                                    >
                                        {uploadingStepId === 'i9Completed' ? t("Uploading...") : t("Submit Document")}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeModalStep === 'directDepositCompleted' && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    {t("Choose how you would like to receive paychecks. Selecting paper check completes this step immediately, while direct deposit preference prepares payroll integration.")}
                                </p>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                    <label htmlFor="dd-direct-deposit" aria-label={t("Direct Deposit")} className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            id="dd-direct-deposit"
                                            type="radio" 
                                            name="ddPref" 
                                            value="Direct Deposit" 
                                            checked={directDepositPref === "Direct Deposit"} 
                                            onChange={() => setDirectDepositPref("Direct Deposit")} 
                                            className="text-primary-600 focus:ring-primary-500" 
                                        />
                                        <span className="text-sm">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{t("Direct Deposit")}</span>
                                            <span className="text-xs text-slate-500 block">{t("Deposit paychecks directly into checking/savings accounts.")}</span>
                                        </span>
                                    </label>
                                    <label htmlFor="dd-paper-check" aria-label={t("Paper Check")} className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            id="dd-paper-check"
                                            type="radio" 
                                            name="ddPref" 
                                            value="Paper Check" 
                                            checked={directDepositPref === "Paper Check"} 
                                            onChange={() => setDirectDepositPref("Paper Check")} 
                                            className="text-primary-600 focus:ring-primary-500" 
                                        />
                                        <span className="text-sm">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{t("Paper Check")}</span>
                                            <span className="text-xs text-slate-500 block">{t("Receive physical checks on paydays.")}</span>
                                        </span>
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Button variant="secondary" onClick={() => setActiveModalStep(null)}>
                                        {t("Cancel")}
                                    </Button>
                                    <Button 
                                        onClick={handleSaveDirectDeposit} 
                                        disabled={!directDepositPref}
                                    >
                                        {t("Save Preference")}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeModalStep === 'idUploaded' && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    {t("Upload a clear photo or copy of your valid Government-issued ID (e.g., Driver's License or Passport) to verify identity for Form I-9 validation.")}
                                </p>
                                {sensitiveData?.formSubmissions?.['government-id']?.fileUrl && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between text-xs text-green-700 font-semibold mt-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-green-500" />
                                            <span>{t("Uploaded ID:")} {sensitiveData.formSubmissions['government-id'].fileName}</span>
                                        </div>
                                        <a href={sensitiveData.formSubmissions['government-id'].fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline flex items-center gap-1">
                                            <ExternalLink size={12} /> {t("View")}
                                        </a>
                                    </div>
                                )}
                                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center">
                                    <label className="cursor-pointer block space-y-2">
                                        <Upload className="mx-auto text-slate-400" size={24} />
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                                            {onboardingFile ? onboardingFile.name : t("Select ID Image/File")}
                                        </span>
                                        <input 
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg" 
                                            className="hidden" 
                                            onChange={e => setOnboardingFile(e.target.files?.[0] || null)} 
                                        />
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <Button variant="secondary" onClick={() => { setActiveModalStep(null); setOnboardingFile(null); }}>
                                        {t("Cancel")}
                                    </Button>
                                    <Button 
                                        onClick={() => handleOnboardingFileUpload('idUploaded')} 
                                        disabled={!onboardingFile || uploadingStepId === 'idUploaded'}
                                    >
                                        {uploadingStepId === 'idUploaded' ? t("Uploading...") : t("Submit ID")}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default HRResources;
