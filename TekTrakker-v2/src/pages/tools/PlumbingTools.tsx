import showToast from "lib/toast";
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    Droplets, Save, Ruler, Activity, Info, 
    Wind, Waves, Thermometer
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const PlumbingTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'flow' | 'slope' | 'sizing' | 'heater'>('flow');

    // --- FLOW RATE STATE ---
    const [gallons, setGallons] = useState('');
    const [seconds, setSeconds] = useState('');

    // --- SLOPE STATE ---
    const [run, setRun] = useState('');
    const [drop, setDrop] = useState('');

    // --- HEATER SIZING ---
    const [bathrooms, setBathrooms] = useState('1');
    const [people, setPeople] = useState('2');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const flowGPM = useMemo(() => {
        const gal = parseFloat(gallons), sec = parseFloat(seconds);
        if (!isNaN(gal) && !isNaN(sec) && sec > 0) return (gal / sec) * 60;
        return 0;
    }, [gallons, seconds]);

    const slopePercent = useMemo(() => {
        const r = parseFloat(run), d = parseFloat(drop);
        if (!isNaN(r) && !isNaN(d) && r > 0) return (d / r) * 100;
        return 0;
    }, [run, drop]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Plumbing_Diagnostics',
                timestamp: new Date().toISOString(),
                data: {
                    flow: { gpm: flowGPM },
                    slope: { run, drop, percent: slopePercent },
                    recommendation: activeTab === 'heater' ? `${bathrooms} bath / ${people} people load` : ''
                },
                performedBy: state.currentUser?.id || 'tech'
            };
            const job = state.jobs.find(j => j.id === selectedJobId);
            if (job) {
                const updatedReadings = [...(job.toolReadings || []), reading];
                await db.collection('jobs').doc(selectedJobId).update({ toolReadings: updatedReadings });
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, toolReadings: updatedReadings } });
            }
            setIsSaveModalOpen(false);
            showToast.warn("Plumbing readings saved.");
        } catch (e) {
            showToast.warn("Save failed.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 pb-32 space-y-6 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600">
                        <Save size={18} className="mr-2" /> Save to Active Job
                    </Button>
                )}
            </header>

            <div className="flex flex-wrap gap-2 overflow-x-auto custom-scrollbar bg-transparent sticky top-0 z-10 p-1 mb-4">
                {[
                    { id: 'flow', label: 'Flow Rate (GPM)', icon: Waves },
                    { id: 'slope', label: 'Drainage Slope', icon: Activity },
                    { id: 'sizing', label: 'Pipe Sizing', icon: Ruler },
                    { id: 'heater', label: 'Water Heaters', icon: Thermometer }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'flow' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Measurement Data" className="space-y-4">
                            <Input label="Measured Volume (Gallons)" type="number" value={gallons} onChange={e => setGallons(e.target.value)} placeholder="e.g. 5" />
                            <Input label="Time to Fill (Seconds)" type="number" value={seconds} onChange={e => setSeconds(e.target.value)} placeholder="e.g. 30" />
                        </Card>
                        <Card title="Resulting Flow" className="flex flex-col justify-center items-center bg-blue-50 dark:bg-blue-900/10 border-blue-100">
                            <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Gallons Per Minute</p>
                            <p className="text-6xl font-black text-blue-600">{flowGPM.toFixed(1)} <span className="text-2xl">GPM</span></p>
                        </Card>
                    </div>
                )}

                {activeTab === 'slope' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Drainage Run" className="space-y-4">
                            <Input label="Horizontal Run (Feet)" type="number" value={run} onChange={e => setRun(e.target.value)} />
                            <Input label="Vertical Drop (Inches)" type="number" value={drop} onChange={e => setDrop(e.target.value)} />
                        </Card>
                        <Card title="Calculated Grade" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Slope Percentage</p>
                            <p className="text-6xl font-black text-primary-600">{slopePercent.toFixed(2)}%</p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                {slopePercent >= 2 ? 
                                    <span className="text-emerald-600 font-bold">✓ Meets IPC Standard (1/4" per ft)</span> : 
                                    <span className="text-amber-600 font-bold">! Low Slope (Potential for clogging)</span>
                                }
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'sizing' && (
                    <Card title="Pipe Capacity Helper" className="space-y-4">
                        <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <Info className="text-slate-400" size={32} />
                            <p className="text-slate-500 text-sm">Fixture Unit (WSFU/DFU) calculation engine coming soon. Reference Table 703.2 for drainage sizing.</p>
                        </div>
                    </Card>
                )}

                {activeTab === 'heater' && (
                    <Card title="Water Heater Selection" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Select label="Bathrooms" value={bathrooms} onChange={e => setBathrooms(e.target.value)}>
                                    <option value="1">1 Bathroom</option>
                                    <option value="2">2 Bathrooms</option>
                                    <option value="3">3 Bathrooms</option>
                                    <option value="4">4+ Bathrooms</option>
                                </Select>
                                <Select label="Occupants" value={people} onChange={e => setPeople(e.target.value)}>
                                    <option value="2">1-2 People</option>
                                    <option value="3">3 People</option>
                                    <option value="4">4 People</option>
                                    <option value="5">5+ People</option>
                                </Select>
                            </div>
                            <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100">
                                <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2">Recommended Capacity</h4>
                                <p className="text-3xl font-black text-indigo-600">50 Gallons</p>
                                <p className="text-xs text-indigo-500 mt-2">Typical First Hour Rating (FHR) needed: 65+ Gallons.</p>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Save Readings to Job">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Save current data to the digital job folder.</p>
                    <Select label="Select Target Job" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                        <option value="">-- Choose an active job --</option>
                        {activeJobs.map(j => <option key={j.id} value={j.id}>{j.customerName} - {formatAddress(j.address)}</option>)}
                    </Select>
                    <Button onClick={handleSaveToJob} disabled={!selectedJobId || isSaving} className="w-full bg-emerald-600">
                        {isSaving ? 'Saving...' : 'Confirm & Save Readings'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default PlumbingTools;


