import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    ShieldCheck, Save, HardDrive, Wifi, Battery, 
    Video
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const SecurityTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'storage' | 'bandwidth' | 'ups'>('storage');

    // --- STORAGE STATE ---
    const [camCount, setCamCount] = useState('');
    const [resolution, setResolution] = useState('1080p');
    const [days, setDays] = useState('30');
    const [fps, setFps] = useState('15');

    // --- BANDWIDTH STATE ---
    const [uploadSpeed, setUploadSpeed] = useState(''); // Mbps

    // --- UPS STATE ---
    const [nvrWatts, setNvrWatts] = useState('50');
    const [camWatts, setCamWatts] = useState('5'); // Avg POE camera
    const [runtime, setRuntime] = useState('60'); // Minutes

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' &&  j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const storageTB = useMemo(() => {
        const count = parseFloat(camCount);
        const dayCount = parseFloat(days);
        const frames = parseFloat(fps);
        
        if (!isNaN(count) && !isNaN(dayCount)) {
            // Approx bitrates (Mbps) per camera
            let bitrate = 2.5; // 1080p
            if (resolution === '4MP') bitrate = 4;
            if (resolution === '4K') bitrate = 8;
            
            // Adjust for FPS (baseline 15)
            bitrate = bitrate * (frames / 15);

            // Total Megabits = Bitrate * Count * Days * 24 * 3600
            const totalMb = bitrate * count * dayCount * 24 * 3600;
            // Convert to TB (divide by 8 for bytes, then 1024^4 for TB or approx 1,000,000 for simplified decimal TB)
            // Using binary TB (TiB): / 8 / 1024 / 1024 / 1024 / 1024
            // Using decimal TB: / 8 / 1,000,000,000,000 ... actually industry standard for drives is decimal.
            const totalTB = totalMb / 8 / 1000000; 
            return totalTB.toFixed(2);
        }
        return '0';
    }, [camCount, resolution, days, fps]);

    const bandwidth = useMemo(() => {
        const count = parseFloat(camCount);
        const frames = parseFloat(fps);
        if (!isNaN(count)) {
            let bitrate = 2.5; // 1080p
            if (resolution === '4MP') bitrate = 4;
            if (resolution === '4K') bitrate = 8;
            bitrate = bitrate * (frames / 15);
            return (bitrate * count).toFixed(1);
        }
        return '0';
    }, [camCount, resolution, fps]);

    const upsVa = useMemo(() => {
        const nvr = parseFloat(nvrWatts);
        const camW = parseFloat(camWatts);
        const count = parseFloat(camCount);
        
        if (!isNaN(nvr) && !isNaN(camW) && !isNaN(count)) {
            const totalWatts = nvr + (camW * count);
            // VA = Watts / PowerFactor (0.7 typical for PC/NVR)
            const requiredVA = totalWatts / 0.7;
            // Simple multiplier for runtime? (Not strictly accurate but good for estimation)
            // A typical 1500VA UPS gives ~10 mins at full load.
            // This needs a proper curve but we'll return the required VA rating to handle the LOAD first.
            return Math.ceil(requiredVA);
        }
        return 0;
    }, [nvrWatts, camWatts, camCount]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Security_System_Calc',
                timestamp: new Date().toISOString(),
                data: {
                    storage: { cameras: camCount, res: resolution, days, tbNeeded: storageTB },
                    bandwidth: { uploadMbps: bandwidth },
                    ups: { loadWatts: upsVa * 0.7, requiredVA: upsVa }
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
            alert("Security calculations saved.");
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
                        <ShieldCheck className="text-indigo-600" /> Security Pro Tools
                    </h2>
                    <p className="text-sm text-gray-500">Calculate storage, bandwidth, and power backup needs.</p>
                </div>
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600">
                        <Save size={18} className="mr-2" /> Save to Active Job
                    </Button>
                )}
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 sticky top-0 z-10 p-1 rounded-t-lg">
                {[
                    { id: 'storage', label: 'HDD Storage', icon: HardDrive },
                    { id: 'bandwidth', label: 'Bandwidth', icon: Wifi },
                    { id: 'ups', label: 'Battery Backup', icon: Battery }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'storage' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="System Specs" className="space-y-4">
                            <Input label="Number of Cameras" type="number" value={camCount} onChange={e => setCamCount(e.target.value)} />
                            <Select label="Resolution" value={resolution} onChange={e => setResolution(e.target.value)}>
                                <option value="1080p">1080p Full HD</option>
                                <option value="4MP">4MP (2K)</option>
                                <option value="4K">8MP (4K)</option>
                            </Select>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Retention (Days)" type="number" value={days} onChange={e => setDays(e.target.value)} />
                                <Input label="Frame Rate (FPS)" type="number" value={fps} onChange={e => setFps(e.target.value)} />
                            </div>
                        </Card>
                        <Card title="Required Storage" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Capacity</p>
                            <p className="text-6xl font-black text-indigo-600">{storageTB} <span className="text-2xl">TB</span></p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                <p className="font-bold">Recommendation:</p>
                                <p className="text-indigo-500">Use Surveillance Rated Drives (e.g. WD Purple, Seagate SkyHawk).</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'bandwidth' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Network Load" className="space-y-4">
                            <Input label="Number of Cameras" type="number" value={camCount} onChange={e => setCamCount(e.target.value)} />
                            <Select label="Stream Quality" value={resolution} onChange={e => setResolution(e.target.value)}>
                                <option value="1080p">1080p</option>
                                <option value="4MP">4MP</option>
                                <option value="4K">4K</option>
                            </Select>
                        </Card>
                        <Card title="Upload Speed Needed" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Bitrate</p>
                            <p className="text-6xl font-black text-blue-500">{bandwidth} <span className="text-2xl">Mbps</span></p>
                            <p className="text-xs text-slate-500 mt-4 font-medium italic">Required for smooth remote viewing of all streams.</p>
                        </Card>
                    </div>
                )}

                {activeTab === 'ups' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Power Draw" className="space-y-4">
                            <Input label="NVR / DVR Wattage" type="number" value={nvrWatts} onChange={e => setNvrWatts(e.target.value)} />
                            <Input label="Avg Watts Per Camera (POE)" type="number" value={camWatts} onChange={e => setCamWatts(e.target.value)} />
                            <Input label="Number of Cameras" type="number" value={camCount} onChange={e => setCamCount(e.target.value)} />
                        </Card>
                        <Card title="Backup Unit" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Min UPS Rating</p>
                            <p className="text-6xl font-black text-emerald-600">{upsVa} <span className="text-2xl">VA</span></p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center">
                                <p className="font-bold">Calculated Load:</p>
                                <p className="text-slate-500">{(upsVa * 0.7).toFixed(0)} Watts</p>
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

export default SecurityTools;

