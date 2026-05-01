import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    TreePine, Save, Ruler, Activity, Info, 
    Layers, Grid, Shovel, Mountain
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const LandscapingTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'volume' | 'sod' | 'plants' | 'grade'>('volume');

    // --- VOLUME STATE ---
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [depth, setDepth] = useState('');

    // --- PLANT SPACING ---
    const [totalArea, setTotalArea] = useState('');
    const [spacing, setSpacing] = useState('');

    // --- GRADE/SLOPE ---
    const [rise, setRise] = useState('');
    const [run, setRun] = useState('');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const volumeCubicYards = useMemo(() => {
        const l = parseFloat(length), w = parseFloat(width), d = parseFloat(depth);
        if (!isNaN(l) && !isNaN(w) && !isNaN(d)) {
            // (L * W * (D/12)) / 27
            return (l * w * (d / 12)) / 27;
        }
        return 0;
    }, [length, width, depth]);

    const plantsNeeded = useMemo(() => {
        const area = parseFloat(totalArea), space = parseFloat(spacing);
        if (!isNaN(area) && !isNaN(space) && space > 0) {
            // space is in inches, convert to feet for area calc or use area in inches
            const spaceInFt = space / 12;
            return area / (spaceInFt * spaceInFt);
        }
        return 0;
    }, [totalArea, spacing]);

    const gradePercent = useMemo(() => {
        const rs = parseFloat(rise), rn = parseFloat(run);
        if (!isNaN(rs) && !isNaN(rn) && rn > 0) return (rs / rn) * 100;
        return 0;
    }, [rise, run]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Landscaping_Estimator',
                timestamp: new Date().toISOString(),
                data: {
                    volume: { cubicYards: volumeCubicYards },
                    plants: { count: Math.ceil(plantsNeeded) },
                    grade: { percent: gradePercent }
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
            alert("Landscaping estimates saved.");
        } catch (e) {
            alert("Save failed.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 pb-32 space-y-6 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TreePine className="text-emerald-600" /> Landscaping Pro Tools
                    </h2>
                    <p className="text-sm text-gray-500">Estimate materials, plant counts, and site grading.</p>
                </div>
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600">
                        <Save size={18} className="mr-2" /> Save to Active Job
                    </Button>
                )}
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 sticky top-0 z-10 p-1 rounded-t-lg">
                {[
                    { id: 'volume', label: 'Bulk Materials', icon: Layers },
                    { id: 'sod', label: 'Sod / Turf', icon: Grid },
                    { id: 'plants', label: 'Plant Spacing', icon: Shovel },
                    { id: 'grade', label: 'Slope & Grade', icon: Mountain }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
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
                        <Card title="Area Dimensions" className="space-y-4">
                            <Input label="Length (Feet)" type="number" value={length} onChange={e => setLength(e.target.value)} />
                            <Input label="Width (Feet)" type="number" value={width} onChange={e => setWidth(e.target.value)} />
                            <Input label="Depth (Inches)" type="number" value={depth} onChange={e => setDepth(e.target.value)} />
                        </Card>
                        <Card title="Material Needed" className="flex flex-col justify-center items-center bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100">
                            <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Cubic Yards</p>
                            <p className="text-6xl font-black text-emerald-700">{volumeCubicYards.toFixed(2)}</p>
                            <p className="text-xs text-emerald-500 mt-4 font-medium italic">~{(volumeCubicYards * 1.5).toFixed(1)} Tons (Avg. weight)</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'sod' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Turf Coverage" className="space-y-4">
                            <Input label="Length (Feet)" type="number" value={length} onChange={e => setLength(e.target.value)} />
                            <Input label="Width (Feet)" type="number" value={width} onChange={e => setWidth(e.target.value)} />
                        </Card>
                        <Card title="Calculated Total" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Square Feet</p>
                            <p className="text-6xl font-black text-primary-600">{(parseFloat(length) * parseFloat(width) || 0).toLocaleString()}</p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                <p className="font-bold">Pallet Estimate:</p>
                                <p className="text-primary-500">{Math.ceil((parseFloat(length) * parseFloat(width) || 0) / 450)} Pallets (450sqft ea)</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'plants' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Spacing Logic" className="space-y-4">
                            <Input label="Total Area (Sq Ft)" type="number" value={totalArea} onChange={e => setTotalArea(e.target.value)} />
                            <Input label="Plant Spacing (Inches O.C.)" type="number" value={spacing} onChange={e => setSpacing(e.target.value)} />
                        </Card>
                        <Card title="Requirements" className="flex flex-col justify-center items-center bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100">
                             <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Plants Needed</p>
                             <p className="text-6xl font-black text-indigo-600">{Math.ceil(plantsNeeded)}</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'grade' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Elevation Change" className="space-y-4">
                            <Input label="Rise / Vertical Drop (Feet)" type="number" value={rise} onChange={e => setRise(e.target.value)} />
                            <Input label="Run / Horizontal Dist (Feet)" type="number" value={run} onChange={e => setRun(e.target.value)} />
                        </Card>
                        <Card title="Calculated Grade" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Percent Slope</p>
                            <p className="text-6xl font-black text-primary-600">{gradePercent.toFixed(1)}%</p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center max-w-[200px]">
                                {gradePercent >= 2 ? 
                                    <span className="text-emerald-600 font-bold">✓ Good Drainage (&gt;2%)</span> : 
                                    <span className="text-amber-600 font-bold">! Flat Area (Check Drainage)</span>
                                }
                            </div>
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

export default LandscapingTools;

