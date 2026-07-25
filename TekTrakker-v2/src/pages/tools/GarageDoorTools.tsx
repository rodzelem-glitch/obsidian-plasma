import showToast from "lib/toast";
import { cleanUndefinedFields } from 'lib/utils';
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    Maximize, Save, ArrowUpRight, ArrowDownRight, Eye
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const GarageDoorTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'spring' | 'balance' | 'photo'>('spring');

    // --- SPRING CALCULATOR ---
    const [doorWeight, setDoorWeight] = useState('');
    const [doorHeight, setDoorHeight] = useState('');
    const [radius, setRadius] = useState('15');

    // --- DOOR BALANCE ---
    const [forceUp, setForceUp] = useState('');
    const [forceDown, setForceDown] = useState('');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const ippt = useMemo(() => {
        const w = parseFloat(doorWeight);
        const h = parseFloat(doorHeight);
        const r = parseFloat(radius);
        
        if (!isNaN(w) && !isNaN(h) && w > 0) {
            // Rough IPPT calculation for a standard torsion spring
            const arm = r === 15 ? 3.5 : 4.0; 
            return (w * arm) / 2; // dividing by 2 assuming two springs
        }
        return 0;
    }, [doorWeight, doorHeight, radius]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'GarageDoor_Diagnostics' as any,
                timestamp: new Date().toISOString(),
                data: {
                    springCalc: activeTab === 'spring' ? { weight: doorWeight, height: doorHeight, targetIppt: ippt } : undefined,
                    balance: activeTab === 'balance' ? { forceUp, forceDown } : undefined
                },
                performedBy: state.currentUser?.id || 'tech'
            };
            const job = state.jobs.find(j => j.id === selectedJobId);
            if (job) {
                const updatedReadings = [...(job.toolReadings || []), reading];
                await db.collection('jobs').doc(selectedJobId).update(cleanUndefinedFields({ toolReadings: updatedReadings }));
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, toolReadings: updatedReadings } });
            }
            setIsSaveModalOpen(false);
            showToast.warn("Garage Door readings saved.");
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
                    { id: 'spring', label: 'Torsion Spring IPPT', icon: Maximize },
                    { id: 'balance', label: 'Door Balance Test', icon: ArrowUpRight },
                    { id: 'photo', label: 'Safety Eye Alignment', icon: Eye }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-orange-500 text-orange-600 bg-orange-50/50 dark:bg-orange-900/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'spring' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Door Specifications" className="space-y-4">
                            <Input label="Door Weight (lbs)" type="number" value={doorWeight} onChange={e => setDoorWeight(e.target.value)} placeholder="e.g. 150" />
                            <Input label="Door Height (ft)" type="number" value={doorHeight} onChange={e => setDoorHeight(e.target.value)} placeholder="e.g. 7" />
                            <Select label="Track Radius" value={radius} onChange={e => setRadius(e.target.value)}>
                                <option value="12">12" Radius</option>
                                <option value="15">15" Radius (Standard)</option>
                                <option value="32">32" Radius (High Lift)</option>
                            </Select>
                        </Card>
                        <Card title="Target IPPT (Per Spring)" className="flex flex-col justify-center items-center bg-orange-50 dark:bg-orange-900/10 border-orange-100">
                            <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">Inch Pounds Per Turn</p>
                            <p className="text-6xl font-black text-orange-600">{ippt > 0 ? ippt.toFixed(1) : '---'} <span className="text-2xl">IPPT</span></p>
                            <p className="text-sm text-slate-500 mt-4 text-center max-w-xs">Use this target IPPT to select matching wire size and length from your spring engineering charts.</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'balance' && (
                    <Card title="Manual Balance Test" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-4">
                                <Input label="Force to Lift from Floor (lbs)" type="number" value={forceUp} onChange={e => setForceUp(e.target.value)} placeholder="e.g. 15" />
                                <Input label="Force to Pull Down from Top (lbs)" type="number" value={forceDown} onChange={e => setForceDown(e.target.value)} placeholder="e.g. 10" />
                             </div>
                             <div className="flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200">
                                {forceUp && forceDown ? (
                                    <>
                                        <p className="text-2xl font-black text-slate-800 dark:text-white">Up: {forceUp} / Down: {forceDown}</p>
                                        {parseFloat(forceUp) > 20 || parseFloat(forceDown) > 20 ? (
                                            <p className="text-red-500 font-bold mt-2 text-sm text-center">Door is out of balance. Springs need adjustment or replacement to prevent opener damage.</p>
                                        ) : (
                                            <p className="text-emerald-500 font-bold mt-2 text-sm text-center">Door is properly balanced. (Safe range)</p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-slate-400 text-sm">Enter forces using a manual scale.</p>
                                )}
                             </div>
                        </div>
                    </Card>
                )}

                {activeTab === 'photo' && (
                    <Card title="Safety Eye Alignment" className="space-y-4">
                        <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <Eye className="text-slate-400" size={32} />
                            <div>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-1">Diagnostic Quick Guide</h4>
                                <ul className="text-slate-500 text-sm list-disc pl-4 space-y-1">
                                    <li><strong>Both LEDs Solid:</strong> Aligned and functioning.</li>
                                    <li><strong>Sending LED Off:</strong> Check wiring to motor head. No power.</li>
                                    <li><strong>Receiving LED Blinking:</strong> Misaligned or lens is dirty/obstructed.</li>
                                    <li><strong>Clicking Motor / Reversing:</strong> Eyes are tripping. Check for sunlight interference or bad sensor.</li>
                                </ul>
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

export default GarageDoorTools;
