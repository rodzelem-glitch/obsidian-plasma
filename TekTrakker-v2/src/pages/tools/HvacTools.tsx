
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
    CalculatorIcon, Wrench, Save, Thermometer, Wind, Droplet, Zap, 
    Ruler, Cpu, Activity, AlertTriangle, FileText, Mail, Download, 
    History, Edit, Trash2, ArrowRight, Zap as Sparkles
} from 'lucide-react';
import { Job, ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

// --- REFRIGERANT DATA & LOGIC ---
const REFRIGERANTS = [
    { value: 'R410A', label: 'R-410A (Puron)', category: 'Residential' },
    { value: 'R22', label: 'R-22 (Freon)', category: 'Legacy/Residential' },
    { value: 'R32', label: 'R-32', category: 'Next-Gen Res' },
    { value: 'R454B', label: 'R-454B (Opteon XL41)', category: 'Next-Gen Res' },
    { value: 'R134a', label: 'R-134a', category: 'Commercial' },
    { value: 'R404A', label: 'R-404A', category: 'Refrigeration' },
    { value: 'R407C', label: 'R-407C', category: 'Commercial' },
    { value: 'R448A', label: 'R-448A (Solstice N40)', category: 'Refrigeration' },
    { value: 'R449A', label: 'R-449A (Opteon XP40)', category: 'Refrigeration' },
    { value: 'R507', label: 'R-507', category: 'Refrigeration' },
    { value: 'R123', label: 'R-123', category: 'Industrial Chiller' },
    { value: 'R514A', label: 'R-514A (Opteon XP30)', category: 'Industrial Chiller' },
    { value: 'R1233zd', label: 'R-1233zd', category: 'Industrial Chiller' },
    { value: 'R1234ze', label: 'R-1234ze', category: 'Industrial Chiller' },
    { value: 'R11', label: 'R-11', category: 'Legacy Industrial' },
    { value: 'R12', label: 'R-12', category: 'Legacy Industrial' },
];

const calculateSatTemp = (pressure: number, type: string): number => {
    if (pressure <= -14.7) return -459.67; // Absolute zero
    const p = pressure + 14.7; // Convert PSIG to PSIA

    switch (type) {
        case 'R410A': return ( -226.7 + 63.8 * Math.log(p));
        case 'R22': return ( -239.3 + 69.4 * Math.log(p));
        case 'R134a': return (-257.6 + 87.2 * Math.log(p));
        case 'R32': return (-228.5 + 64.2 * Math.log(p));
        case 'R404A': return (-235.1 + 65.5 * Math.log(p));
        case 'R407C': return (-242.8 + 68.1 * Math.log(p)); // Average dew point
        case 'R507': return (-234.5 + 65.2 * Math.log(p));
        case 'R454B': return (-230.1 + 64.5 * Math.log(p));
        case 'R448A': return (-238.2 + 66.4 * Math.log(p));
        case 'R449A': return (-238.5 + 66.5 * Math.log(p));
        case 'R123': return (-255 + 95 * Math.log(p > 0 ? p : 0.1));
        case 'R514A': return (-258 + 96.5 * Math.log(p > 0 ? p : 0.1));
        case 'R1233zd': return (-262 + 98 * Math.log(p > 0 ? p : 0.1));
        case 'R1234ze': return (-252 + 89 * Math.log(p > 0 ? p : 0.1));
        case 'R11': return (-268 + 105 * Math.log(p > 0 ? p : 0.1));
        case 'R12': return (-254 + 86 * Math.log(p > 0 ? p : 0.1));
        default: return 0;
    }
};

const IndustryToolsHub: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'refrigerant' | 'airflow' | 'electrical' | 'vrf' | 'chiller'>('refrigerant');

    // --- REFRIGERANT STATE ---
    const [refType, setRefType] = useState(REFRIGERANTS[0].value);
    const [suctionPress, setSuctionPress] = useState('');
    const [suctionTemp, setSuctionTemp] = useState('');
    const [liquidPress, setLiquidPress] = useState('');
    const [liquidTemp, setLiquidTemp] = useState('');

    // --- AIRFLOW STATE ---
    const [returnTemp, setReturnTemp] = useState('');
    const [supplyTemp, setSupplyTemp] = useState('');

    // --- ELECTRICAL STATE ---
    const [volts, setVolts] = useState('');
    const [amps, setAmps] = useState('');
    const [phase, setPhase] = useState<'1' | '3'>('1');

    // --- VRF STATE ---
    const [vrfBrand, setVrfBrand] = useState('Daikin');
    const [vrfModel, setVrfModel] = useState('');
    const [vrfError, setVrfError] = useState('');
    const [vrfAnalysis, setVrfAnalysis] = useState<{ issue: string, steps: string[] } | null>(null);
    const [isAnalyzingVrf, setIsAnalyzingVrf] = useState(false);

    // --- CHILLER STATE ---
    const [chillerData, setChillerData] = useState({
        type: 'WaterCooled' as 'WaterCooled' | 'AirCooled',
        refrigerant: 'R134a',
        evapIn: '', evapOut: '',
        condIn: '', condOut: '',
        approach: ''
    });

    // --- SAVE MODAL STATE ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => {
        const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both';
        return state.jobs.filter(j => 
            j.jobStatus !== 'Completed' && 
            (isAdmin || j.assignedTechnicianId === state.currentUser?.id)
        );
    }, [state.jobs, state.currentUser]);

    const results = useMemo(() => {
        // Refrigerant Calculations
        const sp = parseFloat(suctionPress), st = parseFloat(suctionTemp);
        const lp = parseFloat(liquidPress), lt = parseFloat(liquidTemp);
        let sh = 0, sc = 0;
        if (!isNaN(sp) && !isNaN(st)) sh = st - calculateSatTemp(sp, refType);
        if (!isNaN(lp) && !isNaN(lt)) sc = calculateSatTemp(lp, refType) - lt;

        // Airflow Calculations (Delta T)
        const rt = parseFloat(returnTemp), stt = parseFloat(supplyTemp);
        let deltaT = 0;
        if (!isNaN(rt) && !isNaN(stt)) deltaT = rt - stt;

        // Electrical Calculations
        const v = parseFloat(volts), a = parseFloat(amps);
        let power = 0;
        if (!isNaN(v) && !isNaN(a)) power = phase === '1' ? v * a : v * a * 1.732;

        return { sh, sc, deltaT, power };
    }, [refType, suctionPress, suctionTemp, liquidPress, liquidTemp, returnTemp, supplyTemp, volts, amps, phase]);

    const handleAnalyzeVRF = async () => {
        if (!vrfBrand || !vrfError) return;
        setIsAnalyzingVrf(true);
        setVrfAnalysis(null);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            const prompt = `Senior VRF Tech Support: ${vrfBrand} VRF, Error ${vrfError}. Identify issue and 3-5 tech steps. JSON: { "issue": "...", "steps": ["..."] }`;
            const result: any = await callGeminiAI({ prompt, modelName: 'gemini-3.1-pro-preview', config: { response_mime_type: "application/json" } });
            const cleanJson = (result.data.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            setVrfAnalysis(JSON.parse(cleanJson));
        } catch (e) {
            alert("Analysis failed.");
        } finally {
            setIsAnalyzingVrf(false);
        }
    };

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'HVAC_Diagnostics',
                timestamp: new Date().toISOString(),
                data: {
                    refrigerant: { type: refType, superheat: results.sh, subcooling: results.sc },
                    airflow: { deltaT: results.deltaT },
                    electrical: { power: results.power, volts, amps }
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
            alert("Readings saved.");
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
                        <Wrench className="text-primary-600" /> Technical Tools Hub
                    </h2>
                    <p className="text-sm text-gray-500">Calculate, diagnose, and save system readings.</p>
                </div>
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600">
                        <Save size={18} className="mr-2" /> Save to Active Job
                    </Button>
                )}
            </header>

            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 sticky top-0 z-10 p-1 rounded-t-lg">
                {[
                    { id: 'refrigerant', label: 'Charging', icon: Droplet },
                    { id: 'airflow', label: 'Airflow', icon: Wind },
                    { id: 'electrical', label: 'Electrical', icon: Zap },
                    { id: 'vrf', label: 'VRF AI', icon: Cpu },
                    { id: 'chiller', label: 'Chiller', icon: Activity }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-primary-600 text-primary-600 bg-primary-50/50 dark:bg-primary-900/10' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'refrigerant' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="System Inputs" className="space-y-4">
                            <Select label="Refrigerant Type" value={refType} onChange={e => setRefType(e.target.value)}>
                                {REFRIGERANTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </Select>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Suction Pressure (PSIG)" type="number" value={suctionPress} onChange={e => setSuctionPress(e.target.value)} />
                                <Input label="Suction Temp (°F)" type="number" value={suctionTemp} onChange={e => setSuctionTemp(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Liquid Pressure (PSIG)" type="number" value={liquidPress} onChange={e => setLiquidPress(e.target.value)} />
                                <Input label="Liquid Temp (°F)" type="number" value={liquidTemp} onChange={e => setLiquidTemp(e.target.value)} />
                            </div>
                        </Card>
                        <Card title="Calculated Results" className="flex flex-col justify-center gap-6 bg-slate-50 dark:bg-slate-800/50">
                            <div className="text-center">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Superheat</p>
                                <p className={`text-5xl font-black ${results.sh > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{results.sh.toFixed(1)}°F</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Subcooling</p>
                                <p className={`text-5xl font-black ${results.sc > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{results.sc.toFixed(1)}°F</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'airflow' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Psychrometrics" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Return Dry Bulb (°F)" type="number" value={returnTemp} onChange={e => setReturnTemp(e.target.value)} />
                                <Input label="Supply Dry Bulb (°F)" type="number" value={supplyTemp} onChange={e => setSupplyTemp(e.target.value)} />
                            </div>
                        </Card>
                        <Card title="Performance" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Delta T (Temp Split)</p>
                            <p className="text-6xl font-black text-primary-600">{results.deltaT.toFixed(1)}°F</p>
                            <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-700 border text-xs text-center max-w-[200px]">
                                {results.deltaT >= 16 && results.deltaT <= 22 ? 
                                    <span className="text-emerald-600 font-bold">✓ Normal Operating Range</span> : 
                                    <span className="text-amber-600 font-bold">! Out of Range (Check Airflow/Charge)</span>
                                }
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'electrical' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Amp & Volt Meter" className="space-y-4">
                            <Select label="Phase Configuration" value={phase} onChange={e => setPhase(e.target.value as any)}>
                                <option value="1">Single Phase (120/240V)</option>
                                <option value="3">Three Phase (208/480V)</option>
                            </Select>
                            <Input label="Voltage (V)" type="number" value={volts} onChange={e => setVolts(e.target.value)} />
                            <Input label="Amperage (A)" type="number" value={amps} onChange={e => setAmps(e.target.value)} />
                        </Card>
                        <Card title="Power Consumption" className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Power</p>
                            <p className="text-6xl font-black text-amber-500">{(results.power / 1000).toFixed(2)} <span className="text-2xl">kW</span></p>
                        </Card>
                    </div>
                )}

                {activeTab === 'vrf' && (
                    <Card title="VRF AI Diagnostic Assistant" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Select label="Brand" value={vrfBrand} onChange={e => setVrfBrand(e.target.value)}>
                                <option value="Daikin">Daikin</option>
                                <option value="Mitsubishi">Mitsubishi</option>
                                <option value="LG">LG</option>
                                <option value="Samsung">Samsung</option>
                            </Select>
                            <Input label="Model (Optional)" value={vrfModel} onChange={e => setVrfModel(e.target.value)} placeholder="e.g. RXYQ144" />
                            <Input label="Error Code" value={vrfError} onChange={e => setVrfError(e.target.value)} placeholder="e.g. U4" />
                        </div>
                        <Button onClick={handleAnalyzeVRF} disabled={isAnalyzingVrf || !vrfError} className="w-full h-12 bg-indigo-600">
                            {isAnalyzingVrf ? 'Analyzing...' : 'Diagnose Error Code'}
                        </Button>
                        {vrfAnalysis && (
                            <div className="mt-6 p-6 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 space-y-4 text-left">
                                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                                    <AlertTriangle size={20} /> {vrfAnalysis.issue}
                                </div>
                                <ul className="space-y-2">
                                    {vrfAnalysis.steps.map((s, i) => (
                                        <li key={i} className="flex gap-3 text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">{i+1}</span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Card>
                )}

                {activeTab === 'chiller' && (
                    <Card title="Chiller Logs & Approach" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Select label="Chiller Type" value={chillerData.type} onChange={e => setChillerData({...chillerData, type: e.target.value as any})}>
                                <option value="WaterCooled">Water Cooled</option>
                                <option value="AirCooled">Air Cooled</option>
                            </Select>
                            <Input label="Evap Entering Water (°F)" type="number" value={chillerData.evapIn} onChange={e => setChillerData({...chillerData, evapIn: e.target.value})} />
                            <Input label="Evap Leaving Water (°F)" type="number" value={chillerData.evapOut} onChange={e => setChillerData({...chillerData, evapOut: e.target.value})} />
                            <Input label="Cond Entering Water (°F)" type="number" value={chillerData.condIn} onChange={e => setChillerData({...chillerData, condIn: e.target.value})} />
                            <Input label="Cond Leaving Water (°F)" type="number" value={chillerData.condOut} onChange={e => setChillerData({...chillerData, condOut: e.target.value})} />
                            <Input label="Leaving Saturation Temp (°F)" type="number" value={chillerData.approach} onChange={e => setChillerData({...chillerData, approach: e.target.value})} />
                        </div>
                        <div className="p-4 bg-slate-900 rounded-lg text-white grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Evaporator Delta T</p>
                                <p className="text-2xl font-black text-blue-400">{(parseFloat(chillerData.evapIn) - parseFloat(chillerData.evapOut)).toFixed(1)}°F</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Evaporator Approach</p>
                                <p className="text-2xl font-black text-emerald-400">{(parseFloat(chillerData.evapOut) - parseFloat(chillerData.approach)).toFixed(1)}°F</p>
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

export default IndustryToolsHub;

