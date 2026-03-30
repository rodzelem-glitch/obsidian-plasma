
import React, { useState } from 'react';
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

const HRResources: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [view, setView] = useState<'handbook' | 'safety' | 'certs'>('handbook');
    const { currentUser: user } = state;

    // Safety Form State
    const [incidentType, setIncidentType] = useState<IncidentReport['type']>('Injury');
    const [incidentDesc, setIncidentDesc] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                status: 'Open'
            };
            await db.collection('incidentReports').doc(report.id).set(report);
            dispatch({ type: 'ADD_INCIDENT', payload: report });
            setIncidentDesc('');
            alert('Incident Report Submitted.');
        } catch (error) {
            console.error(error);
            alert('Submission failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-24">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">HR & Safety Portal</h2>
                    <p className="text-gray-600 dark:text-gray-400">Resources, reporting, and records.</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button onClick={() => setView('handbook')} className={`px-4 py-2 text-sm rounded transition-colors ${view === 'handbook' ? 'bg-white dark:bg-gray-600 shadow text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Handbook</button>
                    <button onClick={() => setView('safety')} className={`px-4 py-2 text-sm rounded transition-colors ${view === 'safety' ? 'bg-white dark:bg-gray-600 shadow text-red-600 dark:text-red-200' : 'text-gray-500 dark:text-gray-400'}`}>Safety</button>
                    <button onClick={() => setView('certs')} className={`px-4 py-2 text-sm rounded transition-colors ${view === 'certs' ? 'bg-white dark:bg-gray-600 shadow text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Certifications</button>
                </div>
            </header>

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
                            <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white">
                                {isSubmitting ? 'Submitting...' : 'Submit Official Report'}
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
                                <span className="bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1 rounded-full shadow-sm">Active</span>
                            </div>
                        )) : (
                            <p className="text-gray-500">No certifications recorded on profile.</p>
                        )}
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Upload New Certification</h4>
                            <div className="flex gap-2">
                                <Input label="" type="file" className="flex-1 text-sm" />
                                <Button className="w-auto text-sm">Upload</Button>
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default HRResources;
