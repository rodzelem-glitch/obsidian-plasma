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
    Sparkles, Save, Clock, Beaker, CheckSquare, 
    Droplets
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const CleaningTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'estimator' | 'dilution' | 'checklist'>('estimator');

    // --- ESTIMATOR STATE ---
    const [sqft, setSqft] = useState('');
    const [serviceType, setServiceType] = useState('Standard');
    const [workers, setWorkers] = useState('1');

    // --- DILUTION STATE ---
    const [containerSize, setContainerSize] = useState(''); // Ounces
    const [ratioPart1, setRatioPart1] = useState('1');
    const [ratioPart2, setRatioPart2] = useState('10');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const timeEstimate = useMemo(() => {
        const s = parseFloat(sqft);
        const w = parseFloat(workers);
        if (!isNaN(s) && !isNaN(w) && w > 0) {
            let ratePerHr = 500; // Standard cleaning sqft/hr
            if (serviceType === 'Deep') ratePerHr = 250;
            if (serviceType === 'Move-In/Out') ratePerHr = 200;
            
            const totalHours = s / ratePerHr;
            return totalHours / w;
        }
        return 0;
    }, [sqft, serviceType, workers]);

    const dilution = useMemo(() => {
        const size = parseFloat(containerSize);
        const r1 = parseFloat(ratioPart1);
        const r2 = parseFloat(ratioPart2);
        
        if (!isNaN(size) && !isNaN(r1) && !isNaN(r2) && (r1 + r2) > 0) {
            const totalParts = r1 + r2;
            const chemAmount = (size * r1) / totalParts;
            const waterAmount = size - chemAmount;
            return { chem: chemAmount.toFixed(2), water: waterAmount.toFixed(2) };
        }
        return { chem: '0', water: '0' };
    }, [containerSize, ratioPart1, ratioPart2]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Cleaning_Log',
                timestamp: new Date().toISOString(),
                data: {
                    estimator: { sqft, type: serviceType, estHours: timeEstimate.toFixed(2) },
                    dilution: activeTab === 'dilution' ? { size: containerSize, ratio: `${ratioPart1}:${ratioPart2}` } : null
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
            showToast.warn("Cleaning data saved.");
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
                    { id: 'estimator', label: 'Time Estimate', icon: Clock },
                    { id: 'dilution', label: 'Chemical Mix', icon: Beaker },
                    { id: 'checklist', label: 'Task List', icon: CheckSquare }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-cyan-500 text-cyan-600 bg-cyan-50/50 dark:bg-cyan-900/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'estimator' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Job Details" className="space-y-4">
                            <Input label="Area Size (Sq Ft)" type="number" value={sqft} onChange={e => setSqft(e.target.value)} />
                            <Select label="Service Type" value={serviceType} onChange={e => setServiceType(e.target.value)}>
                                <option value="Standard">Standard Cleaning</option>
                                <option value="Deep">Deep Cleaning</option>
                                <option value="Move-In/Out">Move-In / Move-Out</option>
                            </Select>
                            <Input label="Number of Cleaners" type="number" value={workers} onChange={e => setWorkers(e.target.value)} />
                        </Card>
                        <Card title="Labor Projection" className="flex flex-col justify-center items-center bg-cyan-50 dark:bg-cyan-900/10 border-cyan-100">
                            <p className="text-xs font-black text-cyan-600 uppercase tracking-widest mb-1">Estimated Time</p>
                            <p className="text-6xl font-black text-cyan-700">{timeEstimate.toFixed(1)} hrs</p>
                            <p className="text-xs text-cyan-500 mt-4 font-medium italic">{(timeEstimate * 60).toFixed(0)} minutes total on site.</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'dilution' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Mixing Ratio" className="space-y-4">
                            <Input label="Container Size (Ounces)" type="number" value={containerSize} onChange={e => setContainerSize(e.target.value)} placeholder="32 oz (spray bottle)" />
                            <div className="flex items-end gap-2">
                                <Input label="Chemical Parts" type="number" value={ratioPart1} onChange={e => setRatioPart1(e.target.value)} />
                                <span className="mb-3 font-bold text-slate-400">:</span>
                                <Input label="Water Parts" type="number" value={ratioPart2} onChange={e => setRatioPart2(e.target.value)} />
                            </div>
                        </Card>
                        <Card title="Recipe" className="bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-center p-6 gap-4">
                            <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm">
                                <Beaker size={32} className="text-purple-500" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Chemical</p>
                                    <p className="text-2xl font-black text-purple-600">{dilution.chem} oz</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm">
                                <Droplets size={32} className="text-blue-500" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Water</p>
                                    <p className="text-2xl font-black text-blue-600">{dilution.water} oz</p>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'checklist' && (
                    <Card title="Standard Operating Procedures" className="space-y-4">
                        <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <CheckSquare className="text-slate-400" size={32} />
                            <p className="text-slate-500 text-sm">Interactive checklist templates coming soon. Will support room-by-room photo verification.</p>
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

export default CleaningTools;


