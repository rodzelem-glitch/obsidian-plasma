import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    BrickWall, Save, Ruler, Layers, Hammer,
    Box
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const MasonryTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'block' | 'brick' | 'mortar'>('block');

    // --- BLOCK STATE ---
    const [wallLength, setWallLength] = useState('');
    const [wallHeight, setWallHeight] = useState('');
    const [blockSize, setBlockSize] = useState('8x8x16');

    // --- BRICK STATE ---
    const [brickArea, setBrickArea] = useState('');
    const [brickType, setBrickType] = useState('Standard');

    // --- MORTAR STATE ---
    const [unitCount, setUnitCount] = useState(''); // Number of blocks/bricks

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const blockCount = useMemo(() => {
        const l = parseFloat(wallLength);
        const h = parseFloat(wallHeight);
        if (!isNaN(l) && !isNaN(h)) {
            const area = l * h;
            // Standard 8x8x16 block is 0.89 sqft (nominal)
            // 1.125 blocks per sqft
            return Math.ceil(area * 1.125);
        }
        return 0;
    }, [wallLength, wallHeight]);

    const brickCount = useMemo(() => {
        const area = parseFloat(brickArea);
        if (!isNaN(area)) {
            // Standard modular brick ~6.75 per sqft
            // With waste ~7 per sqft
            return Math.ceil(area * 7);
        }
        return 0;
    }, [brickArea]);

    const mortarBags = useMemo(() => {
        const count = parseFloat(unitCount);
        if (!isNaN(count)) {
            if (activeTab === 'block') {
                // ~3 bags (80lb) per 100 blocks
                return Math.ceil((count / 100) * 3);
            } else {
                // ~7 bags per 1000 bricks
                return Math.ceil((count / 1000) * 7);
            }
        }
        return 0;
    }, [unitCount, activeTab]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Masonry_Estimator',
                timestamp: new Date().toISOString(),
                data: {
                    block: { count: blockCount, size: blockSize },
                    brick: { count: brickCount, type: brickType },
                    mortar: { bags: mortarBags }
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
            alert("Masonry estimates saved.");
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
                        <BrickWall className="text-stone-600" /> Masonry Pro Tools
                    </h2>
                    <p className="text-sm text-gray-500">Calculate block, brick, and mortar requirements.</p>
                </div>
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600">
                        <Save size={18} className="mr-2" /> Save to Active Job
                    </Button>
                )}
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 sticky top-0 z-10 p-1 rounded-t-lg">
                {[
                    { id: 'block', label: 'Concrete Block', icon: Box },
                    { id: 'brick', label: 'Brickwork', icon: Layers },
                    { id: 'mortar', label: 'Mortar / Grout', icon: Hammer }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-stone-600 text-stone-600 bg-stone-50/50 dark:bg-stone-900/10' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'block' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Wall Dimensions" className="space-y-4">
                            <Input label="Length (Feet)" type="number" value={wallLength} onChange={e => setWallLength(e.target.value)} />
                            <Input label="Height (Feet)" type="number" value={wallHeight} onChange={e => setWallHeight(e.target.value)} />
                            <Select label="Block Size" value={blockSize} onChange={e => setBlockSize(e.target.value)}>
                                <option value="8x8x16">Standard 8" (8x8x16)</option>
                                <option value="6x8x16">6" Block (6x8x16)</option>
                                <option value="4x8x16">4" Block (4x8x16)</option>
                            </Select>
                        </Card>
                        <Card title="Material Needed" className="flex flex-col justify-center items-center bg-stone-50 dark:bg-stone-900/10 border-stone-200">
                            <p className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1">Total Blocks</p>
                            <p className="text-6xl font-black text-stone-700">{blockCount}</p>
                            <p className="text-xs text-stone-500 mt-4 font-medium italic">Includes standard breakage allowance.</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'brick' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Coverage Area" className="space-y-4">
                            <Input label="Net Wall Area (Sq Ft)" type="number" value={brickArea} onChange={e => setBrickArea(e.target.value)} placeholder="Subtract windows/doors" />
                            <Select label="Brick Size" value={brickType} onChange={e => setBrickType(e.target.value)}>
                                <option value="Standard">Modular (Standard)</option>
                                <option value="Queen">Queen Size</option>
                                <option value="King">King Size</option>
                            </Select>
                        </Card>
                        <Card title="Brick Estimate" className="flex flex-col justify-center items-center bg-stone-50 dark:bg-stone-900/10 border-stone-200">
                            <p className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1">Bricks Needed</p>
                            <p className="text-6xl font-black text-red-800">{brickCount}</p>
                            <p className="text-xs text-stone-500 mt-4 font-medium italic">Based on 7 bricks per sq ft.</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'mortar' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Job Scope" className="space-y-4">
                            <Input label="Total Unit Count (Blocks/Bricks)" type="number" value={unitCount} onChange={e => setUnitCount(e.target.value)} />
                            <p className="text-xs text-stone-500 italic">Enter the total number of blocks or bricks you calculated in the previous tabs.</p>
                        </Card>
                        <Card title="Mortar Mix" className="flex flex-col justify-center items-center bg-stone-50 dark:bg-stone-900/10 border-stone-200">
                            <p className="text-xs font-black text-stone-500 uppercase tracking-widest mb-1">80lb Bags Needed</p>
                            <p className="text-6xl font-black text-stone-600">{mortarBags}</p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                <p className="font-bold">Sand Estimate:</p>
                                <p className="text-stone-500">~{Math.ceil(mortarBags * 2.5)} cubic feet of sand.</p>
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

export default MasonryTools;

