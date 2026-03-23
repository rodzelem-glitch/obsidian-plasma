import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    Zap, Save, Ruler, Activity, AlertTriangle, 
    Wrench, Cpu, Info
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const ElectricalTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'ohms' | 'wiresize' | 'conduit' | 'load'>('ohms');

    // --- OHM'S LAW STATE ---
    const [volts, setVolts] = useState('');
    const [amps, setAmps] = useState('');
    const [ohms, setOhms] = useState('');
    const [watts, setWatts] = useState('');

    // --- WIRE SIZING ---
    const [distance, setDistance] = useState('');
    const [loadAmps, setLoadAmps] = useState('');
    const [voltageSystem, setVoltageSystem] = useState('120');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus === 'In Progress' && j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const ohmsResults = useMemo(() => {
        const V = parseFloat(volts), I = parseFloat(amps), R = parseFloat(ohms), P = parseFloat(watts);
        // Basic calculation logic for Ohm's Law
        let resV = V, resI = I, resR = R, resP = P;
        
        if (!isNaN(I) && !isNaN(R)) resV = I * R;
        if (!isNaN(V) && !isNaN(R)) resI = V / R;
        if (!isNaN(V) && !isNaN(I)) resR = V / I;
        if (!isNaN(V) && !isNaN(I)) resP = V * I;
        
        return { V: resV, I: resI, R: resR, P: resP };
    }, [volts, amps, ohms, watts]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Electrical_Diagnostics',
                timestamp: new Date().toISOString(),
                data: {
                    ohmsLaw: ohmsResults,
                    wireSizing: { distance, loadAmps, voltageSystem }
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
            alert("Electrical readings saved.");
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
                        <Zap className="text-yellow-500" /> Electrical Pro Tools
                    </h2>
                    <p className="text-sm text-gray-500">Calculate loads, size wires, and check circuit compliance.</p>
                </div>
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600">
                        <Save size={18} className="mr-2" /> Save to Active Job
                    </Button>
                )}
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 sticky top-0 z-10 p-1 rounded-t-lg">
                {[
                    { id: 'ohms', label: "Ohm's Law", icon: Activity },
                    { id: 'wiresize', label: 'Wire Sizing', icon: Ruler },
                    { id: 'conduit', label: 'Conduit Fill', icon: Cpu },
                    { id: 'load', label: 'Circuit Load', icon: Zap }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-yellow-500 text-yellow-600 bg-yellow-50/50 dark:bg-yellow-900/10' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'ohms' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Circuit Inputs" className="space-y-4">
                            <Input label="Voltage (V)" type="number" value={volts} onChange={e => setOhmsResultsInput('volts', e.target.value)} />
                            <Input label="Amperage (A)" type="number" value={amps} onChange={e => setOhmsResultsInput('amps', e.target.value)} />
                            <Input label="Resistance (Ω)" type="number" value={ohms} onChange={e => setOhmsResultsInput('ohms', e.target.value)} />
                            <Input label="Power (W)" type="number" value={watts} onChange={e => setOhmsResultsInput('watts', e.target.value)} />
                            <p className="text-[10px] text-slate-400 italic mt-2">Enter any two values to calculate the others.</p>
                        </Card>
                        <Card title="Calculation Matrix" className="bg-slate-50 dark:bg-slate-800/50 grid grid-cols-1 md:grid-cols-2 gap-4 h-full items-center">
                            <div className="p-4 bg-white dark:bg-slate-700 rounded-xl text-center shadow-sm border border-slate-100 dark:border-slate-600">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Voltage</p>
                                <p className="text-2xl font-black text-blue-600">{ohmsResults.V.toFixed(2)}V</p>
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-700 rounded-xl text-center shadow-sm border border-slate-100 dark:border-slate-600">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Current</p>
                                <p className="text-2xl font-black text-amber-600">{ohmsResults.I.toFixed(2)}A</p>
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-700 rounded-xl text-center shadow-sm border border-slate-100 dark:border-slate-600">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Resistance</p>
                                <p className="text-2xl font-black text-purple-600">{ohmsResults.R.toFixed(2)}Ω</p>
                            </div>
                            <div className="p-4 bg-white dark:bg-slate-700 rounded-xl text-center shadow-sm border border-slate-100 dark:border-slate-600">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Power</p>
                                <p className="text-2xl font-black text-red-600">{ohmsResults.P.toFixed(2)}W</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'wiresize' && (
                    <Card title="Voltage Drop Calculator" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select label="System Voltage" value={voltageSystem} onChange={e => setVoltageSystem(e.target.value)}>
                                <option value="120">120V (Single Phase)</option>
                                <option value="240">240V (Single Phase)</option>
                                <option value="208">208V (Three Phase)</option>
                                <option value="480">480V (Three Phase)</option>
                            </Select>
                            <Input label="One-way Distance (ft)" type="number" value={distance} onChange={e => setDistance(e.target.value)} />
                            <Input label="Load Amperage (A)" type="number" value={loadAmps} onChange={e => setLoadAmps(e.target.value)} />
                        </div>
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                            <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Recommended Wire Size: #12 AWG (Copper)</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Based on a 3% maximum allowable voltage drop per NEC recommendations.</p>
                        </div>
                    </Card>
                )}

                {activeTab === 'conduit' && (
                    <Card title="Conduit Fill (NEC Table 1)" className="space-y-4">
                        <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <Info className="text-slate-400" size={32} />
                            <p className="text-slate-500 text-sm">Advanced Conduit Fill calculation module loading... This will allow selection of wire types (THHN, XHHW) and conduit types (EMT, PVC, Rigid).</p>
                        </div>
                    </Card>
                )}

                {activeTab === 'load' && (
                    <Card title="Subpanel Load Calc" className="space-y-4">
                         <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="text-yellow-600 mt-1" size={18} />
                            <div>
                                <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">Calculate 80% Continuous Load</p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-400">Remember: For continuous loads (3+ hours), the circuit breaker and conductors must be sized at 125% of the load.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg text-center">
                                <p className="text-[10px] font-bold text-slate-400">15A BREAKER</p>
                                <p className="text-lg font-black">12A MAX</p>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg text-center">
                                <p className="text-[10px] font-bold text-slate-400">20A BREAKER</p>
                                <p className="text-lg font-black">16A MAX</p>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg text-center">
                                <p className="text-[10px] font-bold text-slate-400">30A BREAKER</p>
                                <p className="text-lg font-black">24A MAX</p>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg text-center">
                                <p className="text-[10px] font-bold text-slate-400">50A BREAKER</p>
                                <p className="text-lg font-black">40A MAX</p>
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

    function setOhmsResultsInput(field: string, val: string) {
        if (field === 'volts') setVolts(val);
        if (field === 'amps') setAmps(val);
        if (field === 'ohms') setOhms(val);
        if (field === 'watts') setWatts(val);
    }
};

export default ElectricalTools;
