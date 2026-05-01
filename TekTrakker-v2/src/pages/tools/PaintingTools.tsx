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
    Paintbrush, Save, Ruler, Activity, Info, 
    Layers, Droplet, Clock, Calculator
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const PaintingTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'volume' | 'labor' | 'texture' | 'drying'>('volume');

    // --- VOLUME STATE ---
    const [sqft, setSqft] = useState('');
    const [coats, setCoats] = useState('2');
    const [spreadRate, setSpreadRate] = useState('350'); // Avg sqft per gallon

    // --- LABOR ESTIMATOR ---
    const [roomCount, setRoomCount] = useState('');
    const [complexity, setComplexity] = useState('Standard');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const gallonsNeeded = useMemo(() => {
        const s = parseFloat(sqft), c = parseFloat(coats), sr = parseFloat(spreadRate);
        if (!isNaN(s) && !isNaN(c) && !isNaN(sr) && sr > 0) {
            return (s * c) / sr;
        }
        return 0;
    }, [sqft, coats, spreadRate]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Painting_Estimator',
                timestamp: new Date().toISOString(),
                data: {
                    volume: { sqft, coats, gallonsNeeded: gallonsNeeded.toFixed(2) },
                    labor: { complexity, roomCount }
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
            showToast.warn("Painting estimates saved.");
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
                    { id: 'volume', label: 'Paint Volume', icon: Droplet },
                    { id: 'labor', label: 'Labor Estimate', icon: Clock },
                    { id: 'texture', label: 'Texture / Finish', icon: Layers },
                    { id: 'drying', label: 'Drying Time', icon: Activity }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-rose-500 text-rose-600 bg-rose-50/50 dark:bg-rose-900/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'volume' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Surface Details" className="space-y-4">
                            <Input label="Total Surface Area (Sq Ft)" type="number" value={sqft} onChange={e => setSqft(e.target.value)} placeholder="e.g. 1200" />
                            <Select label="Number of Coats" value={coats} onChange={e => setCoats(e.target.value)}>
                                <option value="1">1 Coat (Refresh)</option>
                                <option value="2">2 Coats (Standard)</option>
                                <option value="3">3 Coats (High Contrast)</option>
                            </Select>
                            <Input label="Spread Rate (Sq Ft / Gal)" type="number" value={spreadRate} onChange={e => setSpreadRate(e.target.value)} placeholder="Standard: 350" />
                        </Card>
                        <Card title="Order Requirements" className="flex flex-col justify-center items-center bg-rose-50 dark:bg-rose-900/10 border-rose-100">
                            <p className="text-xs font-black text-rose-400 uppercase tracking-widest mb-1">Gallons Needed</p>
                            <p className="text-6xl font-black text-rose-600">{Math.ceil(gallonsNeeded)}</p>
                            <p className="text-xs text-rose-500 mt-4 font-medium italic">Exact calculation: {gallonsNeeded.toFixed(2)} gal</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'labor' && (
                    <Card title="Quick Labor Estimator" className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Input label="Room Count" type="number" value={roomCount} onChange={e => setRoomCount(e.target.value)} />
                                <Select label="Job Complexity" value={complexity} onChange={e => setComplexity(e.target.value)}>
                                    <option value="Standard">Standard (Wall Only)</option>
                                    <option value="Trim">Includes Trim/Baseboards</option>
                                    <option value="High">Vaulted Ceilings / Repair heavy</option>
                                </Select>
                            </div>
                            <div className="p-6 bg-slate-900 rounded-xl text-white">
                                <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2">Estimated Man Hours</h4>
                                <p className="text-4xl font-black text-rose-400">
                                    {((parseInt(roomCount) || 0) * (complexity === 'High' ? 8 : complexity === 'Trim' ? 6 : 4)).toLocaleString()} hrs
                                </p>
                                <div className="mt-4 space-y-2">
                                    <p className="text-[10px] text-slate-400">INCLUDES:</p>
                                    <ul className="text-xs space-y-1">
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-rose-500 rounded-full" /> Prep & Masking</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-rose-500 rounded-full" /> Setup / Teardown</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 bg-rose-500 rounded-full" /> Minor Caulking</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {activeTab === 'texture' && (
                    <Card title="Texture Application Logic" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 border rounded-xl hover:border-rose-500 transition-colors cursor-pointer bg-white dark:bg-slate-800">
                                <h5 className="font-bold text-sm mb-1">Orange Peel</h5>
                                <p className="text-xs text-slate-500 mb-2">Light to medium spray finish.</p>
                                <p className="text-lg font-black text-slate-900 dark:text-white">$0.10 / sqft</p>
                            </div>
                            <div className="p-4 border rounded-xl hover:border-rose-500 transition-colors cursor-pointer bg-white dark:bg-slate-800">
                                <h5 className="font-bold text-sm mb-1">Knockdown</h5>
                                <p className="text-xs text-slate-500 mb-2">Spray and trowel finish.</p>
                                <p className="text-lg font-black text-slate-900 dark:text-white">$0.12 / sqft</p>
                            </div>
                            <div className="p-4 border rounded-xl hover:border-rose-500 transition-colors cursor-pointer bg-white dark:bg-slate-800">
                                <h5 className="font-bold text-sm mb-1">Smooth / Level 5</h5>
                                <p className="text-xs text-slate-500 mb-2">Architectural grade smooth finish.</p>
                                <p className="text-lg font-black text-slate-900 dark:text-white">$2.50+ / sqft</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-start gap-3">
                            <Info className="text-slate-400 mt-1" size={18} />
                            <p className="text-xs text-slate-600 dark:text-slate-400">Remember to account for lead paint stabilization prep ($85 base cost) on pre-1978 homes.</p>
                        </div>
                    </Card>
                )}

                {activeTab === 'drying' && (
                    <Card title="Drying Condition Monitor" className="space-y-4">
                        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed">
                            <Clock className="text-slate-300 mb-2" size={48} />
                            <p className="text-slate-500 text-sm font-bold">Environmental Analysis Coming Soon</p>
                            <p className="text-xs text-slate-400 max-w-xs text-center mt-1">This module will calculate recoat times based on local humidity and temperature sensor data.</p>
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

export default PaintingTools;


