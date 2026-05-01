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
    Home, Save, Ruler, CloudRain, Shield, 
    ArrowUpRight, Grid
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const RoofingTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'shingles' | 'pitch' | 'ventilation'>('shingles');

    // --- SHINGLES STATE ---
    const [roofArea, setRoofArea] = useState('');
    const [wasteFactor, setWasteFactor] = useState('10');

    // --- PITCH STATE ---
    const [rise, setRise] = useState('');
    const [run, setRun] = useState('12');

    // --- VENTILATION STATE ---
    const [atticArea, setAtticArea] = useState('');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const shingleResults = useMemo(() => {
        const area = parseFloat(roofArea);
        const waste = parseFloat(wasteFactor) / 100;
        
        if (!isNaN(area) && !isNaN(waste)) {
            const totalArea = area * (1 + waste);
            const squares = totalArea / 100;
            const bundles = Math.ceil(squares * 3); // 3 bundles per square
            return { squares: squares.toFixed(2), bundles };
        }
        return { squares: '0', bundles: 0 };
    }, [roofArea, wasteFactor]);

    const pitchAngle = useMemo(() => {
        const r = parseFloat(rise);
        const rn = parseFloat(run);
        
        if (!isNaN(r) && !isNaN(rn) && rn > 0) {
            const angleRad = Math.atan(r / rn);
            const angleDeg = angleRad * (180 / Math.PI);
            return angleDeg.toFixed(1);
        }
        return '0';
    }, [rise, run]);

    const ventilation = useMemo(() => {
        const area = parseFloat(atticArea);
        if (!isNaN(area)) {
            // 1:300 rule (1 sqft of vent per 300 sqft of attic)
            // Split 50/50 between intake (soffit) and exhaust (ridge)
            const nfaTotal = area / 300;
            const nfaSoffit = nfaTotal / 2;
            const nfaRidge = nfaTotal / 2;
            return { total: nfaTotal.toFixed(2), split: nfaSoffit.toFixed(2) };
        }
        return { total: '0', split: '0' };
    }, [atticArea]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Roofing_Estimator',
                timestamp: new Date().toISOString(),
                data: {
                    shingles: shingleResults,
                    pitch: { rise, run, angle: pitchAngle },
                    ventilation: ventilation
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
            showToast.warn("Roofing estimates saved.");
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
                    { id: 'shingles', label: 'Shingles', icon: Grid },
                    { id: 'pitch', label: 'Roof Pitch', icon: ArrowUpRight },
                    { id: 'ventilation', label: 'Ventilation', icon: CloudRain }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-red-700 text-red-700 bg-red-50/50 dark:bg-red-900/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'shingles' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Measurements" className="space-y-4">
                            <Input label="Total Roof Area (Sq Ft)" type="number" value={roofArea} onChange={e => setRoofArea(e.target.value)} />
                            <Select label="Waste Factor" value={wasteFactor} onChange={e => setWasteFactor(e.target.value)}>
                                <option value="5">5% (Simple Gable)</option>
                                <option value="10">10% (Standard Hip)</option>
                                <option value="15">15% (Complex)</option>
                                <option value="20">20% (Cut-up)</option>
                            </Select>
                        </Card>
                        <Card title="Material Needs" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <div className="text-center mb-6">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Squares (100sqft)</p>
                                <p className="text-4xl font-black text-red-700">{shingleResults.squares}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Bundles Needed</p>
                                <p className="text-6xl font-black text-slate-900 dark:text-white">{shingleResults.bundles}</p>
                                <p className="text-xs text-slate-500 mt-2 font-medium italic">Based on standard 3 bundles/square</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'pitch' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Slope Ratio" className="space-y-4">
                            <Input label="Rise (Vertical Inches)" type="number" value={rise} onChange={e => setRise(e.target.value)} />
                            <Input label="Run (Horizontal Inches)" type="number" value={run} onChange={e => setRun(e.target.value)} disabled />
                            <p className="text-xs text-slate-500 italic">Standard run is 12 inches.</p>
                        </Card>
                        <Card title="Angle & Walkability" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Roof Angle</p>
                            <p className="text-6xl font-black text-red-700">{pitchAngle}°</p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                {parseFloat(pitchAngle) <= 18.5 ? 
                                    <span className="text-emerald-600 font-bold">✓ Walkable (Low Pitch 4/12 or less)</span> : 
                                    <span className="text-amber-600 font-bold">! Steep Slope (Safety Gear Req.)</span>
                                }
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'ventilation' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Attic Size" className="space-y-4">
                            <Input label="Attic Floor Area (Sq Ft)" type="number" value={atticArea} onChange={e => setAtticArea(e.target.value)} />
                        </Card>
                        <Card title="NFA Requirements" className="flex flex-col justify-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-6">
                            <div className="flex justify-between items-center border-b pb-2 border-slate-200">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Total NFA (Net Free Area)</span>
                                <span className="text-xl font-black text-red-700">{ventilation.total} sq ft</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">Intake (Soffit)</span>
                                <span className="text-lg font-bold text-slate-700 dark:text-white">{ventilation.split} sq ft</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-500">Exhaust (Ridge)</span>
                                <span className="text-lg font-bold text-slate-700 dark:text-white">{ventilation.split} sq ft</span>
                            </div>
                            <p className="text-[10px] text-slate-400 italic text-center mt-2">Based on 1:300 rule.</p>
                        </Card>
                    </div>
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

export default RoofingTools;


