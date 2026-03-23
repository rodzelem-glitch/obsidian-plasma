import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    Signal, Save, Radio, Network, Activity, 
    Wifi
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const TelecomTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'loss' | 'fiber' | 'signal'>('loss');

    // --- CABLE LOSS STATE ---
    const [cableType, setCableType] = useState('RG6');
    const [frequency, setFrequency] = useState('1000'); // MHz
    const [cableLength, setCableLength] = useState(''); // Feet

    // --- FIBER STATE ---
    const [fiberLength, setFiberLength] = useState(''); // km
    const [spliceCount, setSpliceCount] = useState('2');
    const [connectorCount, setConnectorCount] = useState('2');
    const [wavelength, setWavelength] = useState('1310'); // nm

    // --- SIGNAL LOG ---
    const [signalLocation, setSignalLocation] = useState('');
    const [dbmReading, setDbmReading] = useState('');
    const [notes, setNotes] = useState('');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus === 'In Progress' && j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const cableLoss = useMemo(() => {
        const len = parseFloat(cableLength);
        if (!isNaN(len) && len > 0) {
            // Approx loss per 100ft at 1000MHz
            let lossPer100 = 6.0; // RG6 default
            if (cableType === 'RG11') lossPer100 = 4.0;
            if (cableType === 'RG59') lossPer100 = 8.0;
            if (cableType === 'CAT6') lossPer100 = 20.0; // At high freq, rough est

            // Adjust for frequency (sqrt freq roughly)
            // Just simplifying for demo logic based on 1000MHz baseline
            
            return (len / 100) * lossPer100;
        }
        return 0;
    }, [cableType, cableLength, frequency]);

    const fiberLoss = useMemo(() => {
        const len = parseFloat(fiberLength); // km
        const splices = parseFloat(spliceCount);
        const conns = parseFloat(connectorCount);
        
        if (!isNaN(len)) {
            // Loss per km
            const kmLoss = wavelength === '1310' ? 0.35 : 0.22; // 1550nm is lower loss
            const spliceLoss = splices * 0.1; // 0.1dB per splice
            const connLoss = conns * 0.5; // 0.5dB per connector (conservative)
            
            return (len * kmLoss) + spliceLoss + connLoss;
        }
        return 0;
    }, [fiberLength, spliceCount, connectorCount, wavelength]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Telecom_Signal_Log',
                timestamp: new Date().toISOString(),
                data: {
                    cableCalc: activeTab === 'loss' ? { type: cableType, len: cableLength, loss: cableLoss.toFixed(2) } : null,
                    fiberCalc: activeTab === 'fiber' ? { len: fiberLength, wavelength, loss: fiberLoss.toFixed(2) } : null,
                    signalLog: activeTab === 'signal' ? { loc: signalLocation, dbm: dbmReading, notes } : null
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
            alert("Telecom readings saved.");
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
                        <Radio className="text-cyan-600" /> Telecom Tech Tools
                    </h2>
                    <p className="text-sm text-gray-500">Calculate attenuation, link budgets, and log signals.</p>
                </div>
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600">
                        <Save size={18} className="mr-2" /> Save to Active Job
                    </Button>
                )}
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 sticky top-0 z-10 p-1 rounded-t-lg">
                {[
                    { id: 'loss', label: 'Coax/Copper Loss', icon: Activity },
                    { id: 'fiber', label: 'Fiber Link Budget', icon: Network },
                    { id: 'signal', label: 'Signal Log', icon: Signal }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-cyan-600 text-cyan-600 bg-cyan-50/50 dark:bg-cyan-900/10' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'loss' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Cable Parameters" className="space-y-4">
                            <Select label="Cable Type" value={cableType} onChange={e => setCableType(e.target.value)}>
                                <option value="RG6">RG-6 (Coax)</option>
                                <option value="RG11">RG-11 (Coax)</option>
                                <option value="RG59">RG-59 (Legacy)</option>
                                <option value="CAT6">Cat6 (Ethernet)</option>
                            </Select>
                            <Input label="Length (Feet)" type="number" value={cableLength} onChange={e => setCableLength(e.target.value)} />
                            <Input label="Frequency (MHz)" type="number" value={frequency} onChange={e => setFrequency(e.target.value)} disabled />
                        </Card>
                        <Card title="Estimated Loss" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Attenuation</p>
                            <p className="text-6xl font-black text-red-600">-{cableLoss.toFixed(2)} dB</p>
                            <p className="text-xs text-slate-500 mt-4 font-medium italic">At 1000 MHz (Typical RF)</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'fiber' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Link Specs" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Length (km)" type="number" value={fiberLength} onChange={e => setFiberLength(e.target.value)} />
                                <Select label="Wavelength" value={wavelength} onChange={e => setWavelength(e.target.value)}>
                                    <option value="1310">1310 nm</option>
                                    <option value="1550">1550 nm</option>
                                </Select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Splices" type="number" value={spliceCount} onChange={e => setSpliceCount(e.target.value)} />
                                <Input label="Connectors" type="number" value={connectorCount} onChange={e => setConnectorCount(e.target.value)} />
                            </div>
                        </Card>
                        <Card title="Total Budget" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Loss</p>
                            <p className="text-6xl font-black text-cyan-700">{fiberLoss.toFixed(2)} dB</p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                <p className="font-bold">Standard Limit:</p>
                                <p className="text-slate-500">Ensure Transceiver Power Budget &gt; {fiberLoss.toFixed(2)} dB</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'signal' && (
                    <Card title="Signal Logger" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Location / Room" value={signalLocation} onChange={e => setSignalLocation(e.target.value)} placeholder="e.g. Master Bedroom, Demarc" />
                            <Input label="Reading (dBm)" type="number" value={dbmReading} onChange={e => setDbmReading(e.target.value)} placeholder="e.g. -65" />
                        </div>
                        <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Signal type, interference, etc." />
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Reference Levels</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-center">
                                <div className="p-2 bg-emerald-100 text-emerald-800 rounded">-30 to -50<br/>Excellent</div>
                                <div className="p-2 bg-blue-100 text-blue-800 rounded">-50 to -67<br/>Good</div>
                                <div className="p-2 bg-red-100 text-red-800 rounded">-80 to -90<br/>Poor/Dead</div>
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

export default TelecomTools;
