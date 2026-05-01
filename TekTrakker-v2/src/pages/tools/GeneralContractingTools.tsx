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
    PenTool, Save, Ruler, Activity, Info, 
    Layers, Grid, Shovel, Mountain
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const GeneralContractingTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'drywall' | 'concrete' | 'framing'>('drywall');

    // --- DRYWALL STATE ---
    const [wallLength, setWallLength] = useState('');
    const [wallHeight, setWallHeight] = useState('');
    const [ceilingArea, setCeilingArea] = useState('');

    // --- CONCRETE STATE ---
    const [slabLength, setSlabLength] = useState('');
    const [slabWidth, setSlabWidth] = useState('');
    const [slabThickness, setSlabThickness] = useState('4');

    // --- FRAMING STATE ---
    const [frameLength, setFrameLength] = useState('');
    const [studSpacing, setStudSpacing] = useState('16');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const drywallSheets = useMemo(() => {
        const l = parseFloat(wallLength) || 0;
        const h = parseFloat(wallHeight) || 0;
        const c = parseFloat(ceilingArea) || 0;
        
        const wallSqFt = l * h;
        const totalSqFt = wallSqFt + c;
        // Standard 4x8 sheet is 32 sqft
        return Math.ceil(totalSqFt / 32);
    }, [wallLength, wallHeight, ceilingArea]);

    const concreteYards = useMemo(() => {
        const l = parseFloat(slabLength);
        const w = parseFloat(slabWidth);
        const t = parseFloat(slabThickness);
        
        if (!isNaN(l) && !isNaN(w) && !isNaN(t)) {
            // (L*W*(T/12)) / 27
            return (l * w * (t / 12)) / 27;
        }
        return 0;
    }, [slabLength, slabWidth, slabThickness]);

    const studsNeeded = useMemo(() => {
        const l = parseFloat(frameLength);
        const s = parseFloat(studSpacing);
        
        if (!isNaN(l) && !isNaN(s) && s > 0) {
            // (Length * 12) / spacing + 1 (starter) + corners/intersections (approx 10%)
            const count = ((l * 12) / s) + 1;
            return Math.ceil(count * 1.1); 
        }
        return 0;
    }, [frameLength, studSpacing]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'GC_Estimator',
                timestamp: new Date().toISOString(),
                data: {
                    drywall: { sheets4x8: drywallSheets },
                    concrete: { cubicYards: concreteYards.toFixed(2) },
                    framing: { studs: studsNeeded }
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
            showToast.warn("GC estimates saved.");
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
                    { id: 'drywall', label: 'Drywall', icon: Grid },
                    { id: 'concrete', label: 'Concrete', icon: Layers },
                    { id: 'framing', label: 'Framing', icon: PenTool }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-orange-600 text-orange-600 bg-orange-50/50 dark:bg-orange-900/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'drywall' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Surface Areas" className="space-y-4">
                            <Input label="Wall Length (Feet)" type="number" value={wallLength} onChange={e => setWallLength(e.target.value)} />
                            <Input label="Wall Height (Feet)" type="number" value={wallHeight} onChange={e => setWallHeight(e.target.value)} />
                            <Input label="Ceiling Area (Sq Ft)" type="number" value={ceilingArea} onChange={e => setCeilingArea(e.target.value)} />
                        </Card>
                        <Card title="Material Count" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">4x8 Sheets Needed</p>
                            <p className="text-6xl font-black text-orange-600">{drywallSheets}</p>
                            <p className="text-xs text-slate-500 mt-4 font-medium italic">Includes estimated waste.</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'concrete' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Slab Dimensions" className="space-y-4">
                            <Input label="Length (Feet)" type="number" value={slabLength} onChange={e => setSlabLength(e.target.value)} />
                            <Input label="Width (Feet)" type="number" value={slabWidth} onChange={e => setSlabWidth(e.target.value)} />
                            <Input label="Thickness (Inches)" type="number" value={slabThickness} onChange={e => setSlabThickness(e.target.value)} />
                        </Card>
                        <Card title="Pour Volume" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cubic Yards</p>
                            <p className="text-6xl font-black text-orange-600">{concreteYards.toFixed(2)}</p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                <p className="font-bold">Recommendation:</p>
                                <p className="text-orange-500">Order {Math.ceil(concreteYards * 1.1)} yards to account for uneven grade (10% buffer).</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'framing' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Wall Specs" className="space-y-4">
                            <Input label="Total Wall Length (Linear Ft)" type="number" value={frameLength} onChange={e => setFrameLength(e.target.value)} />
                            <Select label="Stud Spacing" value={studSpacing} onChange={e => setStudSpacing(e.target.value)}>
                                <option value="16">16" On Center</option>
                                <option value="24">24" On Center</option>
                            </Select>
                        </Card>
                        <Card title="Lumber Estimate" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Studs Needed</p>
                            <p className="text-6xl font-black text-orange-600">{studsNeeded}</p>
                            <p className="text-xs text-slate-500 mt-4 font-medium italic">Includes 10% waste & corners.</p>
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

export default GeneralContractingTools;


