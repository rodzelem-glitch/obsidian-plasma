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
    Cpu, Save, Search, Activity, 
    AlertTriangle, Thermometer
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const ApplianceRepairTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'error' | 'lookup' | 'amp' | 'temp'>('error');

    // --- ERROR DECODER ---
    const [brand, setBrand] = useState('Samsung');
    const [errorCode, setErrorCode] = useState('');

    // --- PART LOOKUP ---
    const [modelNumber, setModelNumber] = useState('');
    const [serialNumber, setSerialNumber] = useState('');

    // --- AMP DRAW ---
    const [expectedAmps, setExpectedAmps] = useState('');
    const [measuredAmps, setMeasuredAmps] = useState('');

    // --- TEMP SENSOR ---
    const [measuredTemp, setMeasuredTemp] = useState('');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Appliance_Diagnostics' as any,
                timestamp: new Date().toISOString(),
                data: {
                    errorCode: activeTab === 'error' ? `${brand} - ${errorCode}` : undefined,
                    partLookup: activeTab === 'lookup' ? { model: modelNumber, serial: serialNumber } : undefined,
                    ampDraw: activeTab === 'amp' ? { expected: expectedAmps, measured: measuredAmps } : undefined,
                    temperature: activeTab === 'temp' ? { measured: measuredTemp } : undefined
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
            showToast.warn("Appliance readings saved.");
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
                    { id: 'error', label: 'Error Decoder', icon: AlertTriangle },
                    { id: 'lookup', label: 'Model/Serial Lookup', icon: Search },
                    { id: 'amp', label: 'Amp Draw Test', icon: Activity },
                    { id: 'temp', label: 'Thermistor/Temp', icon: Thermometer }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-900/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'error' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Error Code Entry" className="space-y-4">
                            <Select label="Appliance Brand" value={brand} onChange={e => setBrand(e.target.value)}>
                                <option value="Samsung">Samsung</option>
                                <option value="LG">LG</option>
                                <option value="Whirlpool">Whirlpool</option>
                                <option value="GE">GE Appliances</option>
                                <option value="Bosch">Bosch</option>
                                <option value="Sub-Zero">Sub-Zero</option>
                            </Select>
                            <Input label="Error Code Displayed" value={errorCode} onChange={e => setErrorCode(e.target.value)} placeholder="e.g. 4E, OE, F3E1" />
                        </Card>
                        <Card title="Diagnostic Result" className="flex flex-col justify-center items-center bg-amber-50 dark:bg-amber-900/10 border-amber-100">
                            {errorCode ? (
                                <div className="text-center p-4">
                                    <AlertTriangle size={32} className="mx-auto text-amber-500 mb-2" />
                                    <p className="text-sm font-bold text-amber-600">Possible Issues for {brand} '{errorCode}'</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">Checking manufacturer database... Ensure water supply is connected and drain lines are clear. Verify control board continuity.</p>
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">Enter an error code to decode.</p>
                            )}
                        </Card>
                    </div>
                )}

                {activeTab === 'lookup' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Appliance Lookup" className="space-y-4">
                            <Input label="Model Number" value={modelNumber} onChange={e => setModelNumber(e.target.value)} placeholder="e.g. RF28R7351SG/AA" />
                            <Input label="Serial Number" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Optional" />
                            <Button className="w-full bg-slate-800"><Search size={16} className="mr-2" /> Search Part Diagrams</Button>
                        </Card>
                        <Card title="Diagrams & Parts" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                             <Cpu className="text-slate-300 mb-4" size={48} />
                             <p className="text-slate-500 text-sm text-center px-4">Enter a valid Model Number to instantly access exploded parts views, wiring diagrams, and compatible part numbers.</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'amp' && (
                    <Card title="Compressor / Motor Amp Draw" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-4">
                                <Input label="Expected Rating (RLA/FLA)" type="number" value={expectedAmps} onChange={e => setExpectedAmps(e.target.value)} placeholder="e.g. 4.5" />
                                <Input label="Measured Draw (Amps)" type="number" value={measuredAmps} onChange={e => setMeasuredAmps(e.target.value)} placeholder="e.g. 5.2" />
                             </div>
                             <div className="flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200">
                                {expectedAmps && measuredAmps ? (
                                    <>
                                        <p className="text-2xl font-black text-slate-800 dark:text-white">{measuredAmps}A / {expectedAmps}A</p>
                                        {parseFloat(measuredAmps) > parseFloat(expectedAmps) * 1.1 ? (
                                            <p className="text-red-500 font-bold mt-2 text-sm text-center">Drawing high amps. Potential locked rotor, bad capacitor, or failing motor windings.</p>
                                        ) : (
                                            <p className="text-emerald-500 font-bold mt-2 text-sm text-center">Draw is within normal operating range.</p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-slate-400 text-sm">Enter both expected and measured amps.</p>
                                )}
                             </div>
                        </div>
                    </Card>
                )}

                {activeTab === 'temp' && (
                    <Card title="Thermistor / Temperature Sensor" className="space-y-4">
                        <Input label="Measured Temp (°F)" type="number" value={measuredTemp} onChange={e => setMeasuredTemp(e.target.value)} placeholder="e.g. 38" />
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                            <strong>Note:</strong> Typical refrigerator thermistors should read around 5,000 ohms at 77°F (25°C). Resistance increases as temperature drops. Compare your multimeter reading against the tech sheet chart.
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

export default ApplianceRepairTools;
