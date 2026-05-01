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
    Sun, Save, Ruler, Zap, Battery, 
    ArrowUpRight
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const SolarTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'sizing' | 'tilt' | 'battery'>('sizing');

    // --- SIZING STATE ---
    const [monthlyUsage, setMonthlyUsage] = useState(''); // kWh
    const [sunHours, setSunHours] = useState('5'); // Avg peak sun hours
    const [panelWattage, setPanelWattage] = useState('400');

    // --- TILT STATE ---
    const [latitude, setLatitude] = useState('');
    const [season, setSeason] = useState('Year-Round');

    // --- BATTERY STATE ---
    const [dailyLoad, setDailyLoad] = useState(''); // kWh
    const [autonomyDays, setAutonomyDays] = useState('1');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const systemSize = useMemo(() => {
        const usage = parseFloat(monthlyUsage);
        const hours = parseFloat(sunHours);
        const watts = parseFloat(panelWattage);
        
        if (!isNaN(usage) && !isNaN(hours) && !isNaN(watts) && hours > 0) {
            // Daily usage = Monthly / 30
            const dailyUsage = usage / 30;
            // kW needed = Daily Usage / Sun Hours / Efficiency (0.8)
            const systemKw = dailyUsage / hours / 0.8;
            // Panel Count = (System kW * 1000) / Panel Watts
            const panelCount = Math.ceil((systemKw * 1000) / watts);
            return { kw: systemKw.toFixed(2), panels: panelCount };
        }
        return { kw: '0', panels: 0 };
    }, [monthlyUsage, sunHours, panelWattage]);

    const optimalTilt = useMemo(() => {
        const lat = parseFloat(latitude);
        if (!isNaN(lat)) {
            if (season === 'Year-Round') return (lat * 0.87).toFixed(1);
            if (season === 'Winter') return (lat * 0.9 + 29).toFixed(1);
            if (season === 'Summer') return (lat * 0.9 - 23.5).toFixed(1);
        }
        return '0';
    }, [latitude, season]);

    const batteryBank = useMemo(() => {
        const load = parseFloat(dailyLoad);
        const days = parseFloat(autonomyDays);
        if (!isNaN(load) && !isNaN(days)) {
            // Total kWh needed = Load * Days / Depth of Discharge (0.9 for Li-ion)
            return (load * days / 0.9).toFixed(1);
        }
        return '0';
    }, [dailyLoad, autonomyDays]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Solar_Site_Check',
                timestamp: new Date().toISOString(),
                data: {
                    sizing: { monthlyKwh: monthlyUsage, systemKw: systemSize.kw, panels: systemSize.panels },
                    tilt: { latitude, season, angle: optimalTilt },
                    battery: { load: dailyLoad, days: autonomyDays, requiredKwh: batteryBank }
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
            showToast.warn("Solar data saved.");
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
                    { id: 'sizing', label: 'Array Sizing', icon: Zap },
                    { id: 'tilt', label: 'Tilt Angle', icon: ArrowUpRight },
                    { id: 'battery', label: 'Battery Backup', icon: Battery }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-yellow-500 text-yellow-600 bg-yellow-50/50 dark:bg-yellow-900/10' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'sizing' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Usage Inputs" className="space-y-4">
                            <Input label="Avg Monthly Usage (kWh)" type="number" value={monthlyUsage} onChange={e => setMonthlyUsage(e.target.value)} />
                            <Input label="Peak Sun Hours" type="number" value={sunHours} onChange={e => setSunHours(e.target.value)} placeholder="e.g. 5.5" />
                            <Input label="Panel Wattage (W)" type="number" value={panelWattage} onChange={e => setPanelWattage(e.target.value)} />
                        </Card>
                        <Card title="System Estimate" className="flex flex-col justify-center items-center bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100">
                            <div className="text-center mb-6">
                                <p className="text-xs font-black text-yellow-600 uppercase tracking-widest mb-1">System Size</p>
                                <p className="text-4xl font-black text-yellow-700">{systemSize.kw} kW</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Panels Needed</p>
                                <p className="text-6xl font-black text-slate-900 dark:text-white">{systemSize.panels}</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'tilt' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Location" className="space-y-4">
                            <Input label="Site Latitude" type="number" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="e.g. 34.05" />
                            <Select label="Optimization Goal" value={season} onChange={e => setSeason(e.target.value)}>
                                <option value="Year-Round">Best Annual Production</option>
                                <option value="Summer">Max Summer Production</option>
                                <option value="Winter">Max Winter Production</option>
                            </Select>
                        </Card>
                        <Card title="Optimal Angle" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Panel Tilt</p>
                            <p className="text-6xl font-black text-yellow-600">{optimalTilt}°</p>
                            <p className="text-xs text-slate-500 mt-4 font-medium italic">From horizontal (flat)</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'battery' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Backup Requirements" className="space-y-4">
                            <Input label="Daily Critical Load (kWh)" type="number" value={dailyLoad} onChange={e => setDailyLoad(e.target.value)} />
                            <Input label="Days of Autonomy" type="number" value={autonomyDays} onChange={e => setAutonomyDays(e.target.value)} placeholder="e.g. 1" />
                        </Card>
                        <Card title="Storage Capacity" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Required Battery Size</p>
                            <p className="text-6xl font-black text-emerald-600">{batteryBank} <span className="text-2xl">kWh</span></p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                <p className="font-bold">Recommendation:</p>
                                <p className="text-slate-500">~{Math.ceil(parseFloat(batteryBank) / 13.5)} Tesla Powerwalls (13.5 kWh ea)</p>
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

export default SolarTools;


