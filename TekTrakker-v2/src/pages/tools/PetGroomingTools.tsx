import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    Scissors, Save, Dog, Cat, Heart, 
    ClipboardCheck, FileText
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const PetGroomingTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'log' | 'coat' | 'price'>('log');

    // --- LOG STATE ---
    const [petName, setPetName] = useState('');
    const [petType, setPetType] = useState('Dog');
    const [service, setService] = useState('Full Groom');
    const [behavior, setBehavior] = useState('Good');

    // --- COAT STATE ---
    const [matting, setMatting] = useState('None');
    const [parasites, setParasites] = useState('None');
    const [skinCondition, setSkinCondition] = useState('Healthy');

    // --- PRICE STATE ---
    const [size, setSize] = useState('Small');
    const [coatLength, setCoatLength] = useState('Short');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const estimatedPrice = useMemo(() => {
        let base = 50; // Small, Short
        if (size === 'Medium') base += 20;
        if (size === 'Large') base += 40;
        if (size === 'XL') base += 60;

        if (coatLength === 'Medium') base += 10;
        if (coatLength === 'Long') base += 20;
        if (coatLength === 'Double Coat') base += 30;

        return base;
    }, [size, coatLength]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Grooming_Report',
                timestamp: new Date().toISOString(),
                data: {
                    pet: { name: petName, type: petType, behavior },
                    health: { matting, parasites, skin: skinCondition },
                    service: { type: service, estPrice: estimatedPrice }
                },
                performedBy: state.currentUser?.id || 'groomer'
            };
            const job = state.jobs.find(j => j.id === selectedJobId);
            if (job) {
                const updatedReadings = [...(job.toolReadings || []), reading];
                await db.collection('jobs').doc(selectedJobId).update({ toolReadings: updatedReadings });
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, toolReadings: updatedReadings } });
            }
            setIsSaveModalOpen(false);
            alert("Grooming report saved.");
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
                        <Scissors className="text-pink-500" /> Grooming Tools
                    </h2>
                    <p className="text-sm text-gray-500">Track pet health, behavior, and pricing.</p>
                </div>
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600">
                        <Save size={18} className="mr-2" /> Save to Active Job
                    </Button>
                )}
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 sticky top-0 z-10 p-1 rounded-t-lg">
                {[
                    { id: 'log', label: 'Pet Log', icon: FileText },
                    { id: 'coat', label: 'Health Check', icon: Heart },
                    { id: 'price', label: 'Price Estimator', icon: ClipboardCheck }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-pink-500 text-pink-600 bg-pink-50/50 dark:bg-pink-900/10' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'log' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Pet Details" className="space-y-4">
                            <Input label="Pet Name" value={petName} onChange={e => setPetName(e.target.value)} />
                            <Select label="Type" value={petType} onChange={e => setPetType(e.target.value)}>
                                <option value="Dog">Dog</option>
                                <option value="Cat">Cat</option>
                                <option value="Other">Other</option>
                            </Select>
                            <Select label="Service" value={service} onChange={e => setService(e.target.value)}>
                                <option value="Full Groom">Full Groom</option>
                                <option value="Bath & Brush">Bath & Brush</option>
                                <option value="Nail Trim">Nail Trim</option>
                            </Select>
                        </Card>
                        <Card title="Behavior Notes" className="bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-center gap-4 p-6">
                            <Select label="Temperament" value={behavior} onChange={e => setBehavior(e.target.value)}>
                                <option value="Good">Good / Friendly</option>
                                <option value="Anxious">Anxious / Nervous</option>
                                <option value="Aggressive">Aggressive / Caution</option>
                                <option value="Senior">Senior / Gentle</option>
                            </Select>
                            <div className={`p-4 rounded-lg border text-center font-bold ${
                                behavior === 'Good' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                behavior === 'Aggressive' ? 'bg-red-100 text-red-700 border-red-200' :
                                'bg-blue-100 text-blue-700 border-blue-200'
                            }`}>
                                {behavior === 'Aggressive' ? '⚠ USE MUZZLE / EXTRA CAUTION' : 
                                 behavior === 'Senior' ? '⚠ SUPPORT JOINTS / NO JUMPING' : 'Standard Handling'}
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'coat' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card title="Matting Check" className="space-y-4">
                            <Select label="Severity" value={matting} onChange={e => setMatting(e.target.value)}>
                                <option value="None">None</option>
                                <option value="Light">Light (Brush out)</option>
                                <option value="Heavy">Heavy (Shave needed)</option>
                                <option value="Pelted">Pelted (Vet recommended)</option>
                            </Select>
                        </Card>
                        <Card title="Parasites" className="space-y-4">
                            <Select label="Presence" value={parasites} onChange={e => setParasites(e.target.value)}>
                                <option value="None">None Found</option>
                                <option value="Fleas">Fleas</option>
                                <option value="Ticks">Ticks</option>
                            </Select>
                        </Card>
                        <Card title="Skin" className="space-y-4">
                            <Select label="Condition" value={skinCondition} onChange={e => setSkinCondition(e.target.value)}>
                                <option value="Healthy">Healthy</option>
                                <option value="Dry/Flaky">Dry / Flaky</option>
                                <option value="Hot Spots">Hot Spots / Redness</option>
                                <option value="Warts/Lumps">Warts / Lumps</option>
                            </Select>
                        </Card>
                    </div>
                )}

                {activeTab === 'price' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Sizing" className="space-y-4">
                            <Select label="Pet Size" value={size} onChange={e => setSize(e.target.value)}>
                                <option value="Small">Small (&lt;20lbs)</option>
                                <option value="Medium">Medium (20-50lbs)</option>
                                <option value="Large">Large (50-80lbs)</option>
                                <option value="XL">XL (&gt;80lbs)</option>
                            </Select>
                            <Select label="Coat Type" value={coatLength} onChange={e => setCoatLength(e.target.value)}>
                                <option value="Short">Short / Smooth</option>
                                <option value="Medium">Medium / Wavy</option>
                                <option value="Long">Long / Curly</option>
                                <option value="Double Coat">Double Coat / Thick</option>
                            </Select>
                        </Card>
                        <Card title="Quote" className="flex flex-col justify-center items-center bg-pink-50 dark:bg-pink-900/10 border-pink-100">
                            <p className="text-xs font-black text-pink-400 uppercase tracking-widest mb-1">Base Price</p>
                            <p className="text-6xl font-black text-pink-600">${estimatedPrice}</p>
                            <p className="text-xs text-pink-500 mt-4 font-medium italic">Does not include dematting fees.</p>
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

export default PetGroomingTools;

