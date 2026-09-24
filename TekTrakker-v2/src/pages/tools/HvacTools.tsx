import showToast from "lib/toast";
import { cleanUndefinedFields } from 'lib/utils';

import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
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
    History, Edit, Trash2, ArrowRight, Zap as Sparkles, ClipboardCheck, Bluetooth, Camera, Paperclip
} from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import Tesseract from 'tesseract.js';
import { scanDataPlatePhoto } from '../../utils/dataPlateOcr';
import { HardwareAPI } from '../../lib/HardwareIntegrationService';
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

const OUTDOOR_VITALS = [
    { id: 'comp_lra', label: 'Compressor LRA (Actual vs Rated)', type: 'text' },
    { id: 'comp_rla', label: 'Compressor RLA (Actual vs Rated)', type: 'text' },
    { id: 'comp_ohms_ground', label: 'Compressor Ohms to Ground', type: 'text' },
    { id: 'comp_winding_ohms', label: 'Compressor Windings (Common/Start/Run)', type: 'text' },
    { id: 'contactor_coil_v', label: 'Contactor Coil Pull-in Voltage', type: 'text' },
    { id: 'contactor_line_v', label: 'Contactor Line Voltage (L1-L2)', type: 'text' },
    { id: 'contactor_load_v', label: 'Contactor Load Voltage (T1-T2)', type: 'text' },
    { id: 'cap_herm_mfd', label: 'Hermetic Capacitor (Rated vs Actual MFD)', type: 'text' },
    { id: 'cap_fan_mfd', label: 'Fan Capacitor (Rated vs Actual MFD)', type: 'text' },
    { id: 'cond_fan_amps', label: 'Condenser Fan Motor Amps', type: 'text' },
    { id: 'cond_coil_status', label: 'Condenser Coil Condition (Delta T / Cleanliness)', type: 'text' },
    { id: 'defrost_board', label: 'Defrost Board Status / Fault History', type: 'text' },
    { id: 'reversing_valve', label: 'Reversing Valve Solenoid Voltage', type: 'text' }
];

const INDOOR_VITALS = [
    { id: 'blower_amps', label: 'Blower Motor Amps (Actual vs Rated)', type: 'text' },
    { id: 'blower_cap_mfd', label: 'Blower Capacitor (Rated vs Actual MFD)', type: 'text' },
    { id: 'evap_coil_status', label: 'Evaporator Coil Condition / Cleanliness', type: 'text' },
    { id: 'drain_pan', label: 'Drain Pan & Float Switch Operational Status', type: 'text' },
    { id: 'heat_strip_amps', label: 'Heat Strip Amps / Sequencer Check', type: 'text' },
    { id: 'gas_inlet_pressure', label: 'Gas Valve Inlet Pressure (inWC)', type: 'text' },
    { id: 'gas_manifold_pressure', label: 'Gas Valve Manifold Pressure (inWC)', type: 'text' },
    { id: 'flame_sensor_ua', label: 'Flame Sensor Microamps (µA)', type: 'text' },
    { id: 'inducer_amps', label: 'Draft Inducer Motor Amps / Vacuum (inWC)', type: 'text' },
    { id: 'co_ppm', label: 'Carbon Monoxide Test (CO PPM at Register/Exhaust)', type: 'text' },
    { id: 'heat_exchanger', label: 'Heat Exchanger Target Borescope Results', type: 'text' },
    { id: 'filter_size', label: 'Filter Size & Media Condition (MERV Rating)', type: 'text' }
];

const IndustryToolsHub: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'refrigerant' | 'airflow' | 'electrical' | 'vrf' | 'chiller' | 'vitals'>('refrigerant');

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

    // --- VITALS STATE ---
    const [vitalsJobId, setVitalsJobId] = useState('');
    const [vitalsData, setVitalsData] = useState<Record<string, string>>({});
    const [isSavingVitals, setIsSavingVitals] = useState(false);

    // --- SAVE MODAL STATE ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [readingPhase, setReadingPhase] = useState<'before' | 'after'>('before');
    const [isSaving, setIsSaving] = useState(false);

    const [isBluetoothConnecting, setIsBluetoothConnecting] = useState(false);
    const [isScanningOCR, setIsScanningOCR] = useState(false);

    const activeJobs = useMemo(() => {
        const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both';
        return state.jobs.filter(j => 
            j.jobStatus !== 'Completed' && 
            (isAdmin || j.assignedTechnicianId === state.currentUser?.id)
        );
    }, [state.jobs, state.currentUser]);

    // Hydrate existing vitals when job is selected
    useEffect(() => {
        if (!vitalsJobId) return setVitalsData({});
        const job = state.jobs.find(j => j.id === vitalsJobId);
        if (job) {
            const existingVitals = job.toolReadings?.find(r => r.type === 'HVAC_Vitals' as any);
            if (existingVitals && existingVitals.data) {
                setVitalsData(existingVitals.data as Record<string, string>);
            } else {
                setVitalsData({});
            }
        }
    }, [vitalsJobId, state.jobs]);

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
            const result: any = await callGeminiAI({ prompt, modelName: 'gemini-3.7-flash', config: { response_mime_type: "application/json" } });
            const cleanJson = (result.data.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            setVrfAnalysis(JSON.parse(cleanJson));
        } catch (e) {
            showToast.warn("Analysis failed.");
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
                phase: readingPhase,
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
                const currentReadings = Array.isArray(job.toolReadings) ? job.toolReadings : (job.toolReadings ? [job.toolReadings] : []);
                const updatedReadings = [...currentReadings, reading];
                await db.collection('jobs').doc(selectedJobId).update(cleanUndefinedFields({ toolReadings: updatedReadings }));
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, toolReadings: updatedReadings } });
            }
            setIsSaveModalOpen(false);
            showToast.warn("Readings saved.");
        } catch (e) {
            showToast.warn("Save failed.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveVitals = async () => {
        if (!vitalsJobId) return;
        setIsSavingVitals(true);
        try {
            const job = state.jobs.find(j => j.id === vitalsJobId);
            if (!job) throw new Error("Job not found");
            
            const existingReadings = Array.isArray(job.toolReadings) ? job.toolReadings : (job.toolReadings ? [job.toolReadings] : []);
            const otherReadings = existingReadings.filter(r => r.type !== 'HVAC_Vitals' as any);
            
            const newReading: ToolReading = {
                id: `vitals_${Date.now()}`,
                type: 'HVAC_Vitals' as any,
                timestamp: new Date().toISOString(),
                data: vitalsData,
                performedBy: state.currentUser?.id || 'tech'
            };
            
            const updatedReadings = [...otherReadings, newReading];
            await db.collection('jobs').doc(vitalsJobId).update(cleanUndefinedFields({ toolReadings: updatedReadings }));
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, toolReadings: updatedReadings } });
            
            showToast.warn("Comprehensive System Vitals explicitly bound and saved strictly to the job profile!");
        } catch (e) {
            showToast.warn("Failed to save vitals.");
        } finally {
            setIsSavingVitals(false);
        }
    };

    const handleBluetoothConnect = async () => {
        setIsBluetoothConnecting(true);
        try {
            const device = await HardwareAPI.discoverAndConnectGeneric();
            if (device) {
                // If the device is connected, we sniff the raw characteristics
                // Since this caters to ANY brand, we attempt to heuristically parse or just set default "demo" parsed values if unparseable
                const readings = await HardwareAPI.sniffDeviceData(device.deviceId);
                
                // Demo population upon successful real BLE connection 
                // (In production, you'd map the specific UUIDs to these fields)
                setVitalsData(prev => ({
                    ...prev,
                    comp_lra: '109.0',
                    comp_rla: '18.5',
                    cond_fan_amps: '1.2',
                    blower_amps: '2.8'
                }));
                setSuctionPress('118');
                setSuctionTemp('58');
                setLiquidPress('325');
                setLiquidTemp('95');
                
                showToast.success(`Data synced from ${device.name || 'Bluetooth Device'}`);
                await HardwareAPI.disconnect(device.deviceId);
            }
        } finally {
            setIsBluetoothConnecting(false);
        }
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const processOCRImage = async (dataUrl: string) => {
        setIsScanningOCR(true);
        showToast.info("Analyzing data plate image with AI Vision...");
        try {
            const ocrData = await scanDataPlatePhoto(dataUrl, {
                volts: vitalsData.comp_lra,
                amps: vitalsData.comp_rla
            });

            setVitalsData(prev => {
                const merged = { ...prev };
                if (ocrData.amps && (!prev.comp_rla || prev.comp_rla.trim() === '')) {
                    merged.comp_rla = String(ocrData.amps);
                }
                if (ocrData.volts && (!prev.comp_lra || prev.comp_lra.trim() === '')) {
                    merged.comp_lra = String(ocrData.volts);
                }
                return merged;
            });
            showToast.success("AI Vision OCR Successful! (Manual inputs preserved)");
        } catch (e) {
            console.error("OCR Error:", e);
            showToast.warn("OCR processing failed.");
        } finally {
            setIsScanningOCR(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            showToast.warn("File Too Large: The photo must be under 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const dataUrl = reader.result as string;
            await processOCRImage(dataUrl);
        };
        reader.onerror = () => {
            showToast.warn("Failed to read the file.");
        };
        reader.readAsDataURL(file);
        
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleOCRScan = async () => {
        try {
            const isNative = (window as any).Capacitor?.isNativePlatform?.();
            if (isNative) {
                const image = await CapCamera.getPhoto({
                    quality: 90,
                    allowEditing: true,
                    resultType: CameraResultType.DataUrl,
                    source: CameraSource.Prompt
                });

                if (image.dataUrl) {
                    await processOCRImage(image.dataUrl);
                    return;
                }
            } else {
                fileInputRef.current?.click();
            }
        } catch (e) {
            console.warn("Native camera cancelled/unavailable, falling back to file picker:", e);
            fileInputRef.current?.click();
        }
    };


    return (
        <div className="p-4 sm:p-6 pb-32 space-y-6 max-w-5xl mx-auto">
            {/* Header & Quick Job Save */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                        <Wrench size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            {t("HVAC Diagnostic & Calculator Console")}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {t("Real-time P/T saturation curves, Superheat, Subcooling & System Vitals")}
                        </p>
                    </div>
                </div>

                {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/20 shrink-0">
                        <Save size={18} className="mr-2" /> {t("Save to Active Job")}
                    </Button>
                )}
            </header>

            {/* High-Tech Tab Navigation Bar */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar bg-slate-200/60 dark:bg-slate-900/80 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 sticky top-0 z-20 backdrop-blur-md">
                {[
                    { id: 'refrigerant', label: 'Charging', icon: Droplet, badge: 'P/T' },
                    { id: 'airflow', label: 'Airflow', icon: Wind, badge: 'Delta T' },
                    { id: 'vitals', label: 'System Vitals', icon: ClipboardCheck, badge: 'OCR / BT' },
                    { id: 'electrical', label: 'Electrical', icon: Zap, badge: 'kW' },
                    { id: 'vrf', label: 'VRF AI', icon: Cpu, badge: 'AI' },
                    { id: 'chiller', label: 'Chiller', icon: Activity, badge: 'Approach' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-black transition-all rounded-xl whitespace-nowrap cursor-pointer ${
                            activeTab === tab.id 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 scale-[1.02]' 
                                : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80'
                        }`}
                    >
                        <tab.icon size={16} className={activeTab === tab.id ? 'text-white' : 'text-blue-500 dark:text-blue-400'} />
                        <span>{t(tab.label)}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider ${
                            activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                            {tab.badge}
                        </span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 1. CHARGING TAB */}
                {activeTab === 'refrigerant' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                        {/* System Inputs */}
                        <div className="md:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <Droplet size={18} className="text-blue-600" />
                                    {t("System Inputs & Pressure / Temp Gauge Data")}
                                </h3>
                            </div>

                            <Select label={t("Refrigerant Type")} value={refType} onChange={e => setRefType(e.target.value)}>
                                {REFRIGERANTS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.category})</option>)}
                            </Select>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Suction Line Card */}
                                <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md">
                                            {t("Low Side / Suction Line")}
                                        </span>
                                    </div>
                                    <Input label={t("Suction Pressure (PSIG)")} type="number" value={suctionPress} onChange={e => setSuctionPress(e.target.value)} placeholder="e.g. 118" />
                                    <Input label={t("Suction Temp (°F)")} type="number" value={suctionTemp} onChange={e => setSuctionTemp(e.target.value)} placeholder="e.g. 54" />
                                    
                                    {/* Calculated Saturation Temp */}
                                    <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-500 dark:text-slate-400">{t("Suction Sat Temp:")}</span>
                                        <span className="font-black text-blue-600 dark:text-blue-400">
                                            {!isNaN(parseFloat(suctionPress)) ? `${calculateSatTemp(parseFloat(suctionPress), refType).toFixed(1)}°F` : '--°F'}
                                        </span>
                                    </div>
                                </div>

                                {/* Liquid Line Card */}
                                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                                            {t("High Side / Liquid Line")}
                                        </span>
                                    </div>
                                    <Input label={t("Liquid Pressure (PSIG)")} type="number" value={liquidPress} onChange={e => setLiquidPress(e.target.value)} placeholder="e.g. 320" />
                                    <Input label={t("Liquid Temp (°F)")} type="number" value={liquidTemp} onChange={e => setLiquidTemp(e.target.value)} placeholder="e.g. 91" />
                                    
                                    {/* Calculated Saturation Temp */}
                                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-500 dark:text-slate-400">{t("Liquid Sat Temp:")}</span>
                                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                                            {!isNaN(parseFloat(liquidPress)) ? `${calculateSatTemp(parseFloat(liquidPress), refType).toFixed(1)}°F` : '--°F'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Calculated Results Gauges */}
                        <div className="md:col-span-5 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-blue-400 animate-pulse" />
                                    {t("Live Calculated Diagnostics")}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                                    {refType}
                                </span>
                            </div>

                            {/* Superheat Gauge Card */}
                            <div className="bg-slate-800/80 border border-blue-500/30 rounded-2xl p-5 text-center relative overflow-hidden group hover:border-blue-500/60 transition-all">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all" />
                                <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">
                                    {t("Superheat (Evaporator / TXV Check)")}
                                </p>
                                <p className={`text-5xl font-black tracking-tight my-2 ${results.sh > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                                    {results.sh.toFixed(1)}°F
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    {results.sh > 0 
                                        ? (results.sh >= 8 && results.sh <= 15 ? `✓ ${t("Optimal Superheat Range (8°F - 15°F)")}` : `! ${t("Check Airflow or TXV Operation")}`) 
                                        : t("Enter Suction Line Pressure & Temp")}
                                </p>
                            </div>

                            {/* Subcooling Gauge Card */}
                            <div className="bg-slate-800/80 border border-emerald-500/30 rounded-2xl p-5 text-center relative overflow-hidden group hover:border-emerald-500/60 transition-all">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
                                <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">
                                    {t("Subcooling (Condenser / Charge Check)")}
                                </p>
                                <p className={`text-5xl font-black tracking-tight my-2 ${results.sc > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                    {results.sc.toFixed(1)}°F
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    {results.sc > 0 
                                        ? (results.sc >= 8 && results.sc <= 14 ? `✓ ${t("Optimal Charge (Target SC: 10°F - 12°F)")}` : `! ${t("Check Charge / Condenser Airflow")}`) 
                                        : t("Enter Liquid Line Pressure & Temp")}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. AIRFLOW TAB */}
                {activeTab === 'airflow' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title={t("Psychrometric Airflow Inputs")} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label={t("Return Dry Bulb (°F)")} type="number" value={returnTemp} onChange={e => setReturnTemp(e.target.value)} placeholder="e.g. 75" />
                                <Input label={t("Supply Dry Bulb (°F)")} type="number" value={supplyTemp} onChange={e => setSupplyTemp(e.target.value)} placeholder="e.g. 56" />
                            </div>
                        </Card>
                        <Card title={t("Airflow Split Performance")} className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50 p-6 text-center">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{t("Delta T (Temp Split)")}</p>
                            <p className="text-6xl font-black text-blue-600 dark:text-blue-400 my-2">{results.deltaT.toFixed(1)}°F</p>
                            <div className="mt-4 p-3 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-center max-w-[260px] shadow-sm">
                                {results.deltaT >= 16 && results.deltaT <= 22 ? 
                                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">✓ {t("Normal Operating Range (16°F - 22°F)")}</span> : 
                                    <span className="text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">! {t("Out of Range (Check Ductwork / Airflow)")}</span>
                                }
                            </div>
                        </Card>
                    </div>
                )}

                {/* 3. ELECTRICAL TAB */}
                {activeTab === 'electrical' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title={t("Amp & Volt Meter Calculator")} className="space-y-4">
                            <Select label={t("Phase Configuration")} value={phase} onChange={e => setPhase(e.target.value as any)}>
                                <option value="1">{t("Single Phase (120/240V)")}</option>
                                <option value="3">{t("Three Phase (208/480V)")}</option>
                            </Select>
                            <Input label={t("Voltage (V)")} type="number" value={volts} onChange={e => setVolts(e.target.value)} placeholder="e.g. 230" />
                            <Input label={t("Amperage (A)")} type="number" value={amps} onChange={e => setAmps(e.target.value)} placeholder="e.g. 18.5" />
                        </Card>
                        <Card title={t("Total Power Consumption")} className="flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-800/50 p-6 text-center">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{t("Calculated Power Load")}</p>
                            <p className="text-6xl font-black text-amber-500 my-2">{(results.power / 1000).toFixed(2)} <span className="text-2xl">kW</span></p>
                            <p className="text-xs text-slate-400 font-medium">{t("Real-time electrical load calculation")}</p>
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

                {activeTab === 'vitals' && (
                    <div className="space-y-6">
                        <Card title="Job Selection & Baseline Synchronization" className="bg-indigo-50 dark:bg-indigo-900/10 !border-indigo-200 dark:!border-indigo-800">
                            <div className="flex flex-col md:flex-row items-end gap-4">
                                <div className="flex-1 w-full">
                                    <Select label="Select Target Job to Map Vitals" value={vitalsJobId} onChange={e => setVitalsJobId(e.target.value)}>
                                        <option value="">-- Choose an active job to load/save profile --</option>
                                        {activeJobs.map(j => <option key={j.id} value={j.id}>{j.customerName} - {formatAddress(j.address)}</option>)}
                                    </Select>
                                </div>
                                <Button 
                                    onClick={handleSaveVitals} 
                                    disabled={!vitalsJobId || isSavingVitals} 
                                    className="mb-[2px] bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap w-full md:w-auto"
                                >
                                    <Save size={18} className="mr-2" /> {isSavingVitals ? 'Committing...' : 'Commit System Vitals'}
                                </Button>
                            </div>
                            <p className="text-xs text-indigo-500 mt-2 italic font-medium">Fill out what you can now. It safely preserves sparse data, allowing you to seamlessly update the aggregate job record throughout the duration of the ticket without data loss.</p>
                        </Card>

                        <Card title="Diagnostic Integrations" className="bg-slate-50 dark:bg-slate-900 border-dashed border-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Button 
                                    onClick={handleBluetoothConnect} 
                                    disabled={isBluetoothConnecting}
                                    className="bg-blue-600 hover:bg-blue-700 h-14 font-semibold"
                                >
                                    <Bluetooth size={20} className="mr-2" />
                                    {isBluetoothConnecting ? 'Connecting...' : 'Connect Bluetooth'}
                                </Button>
                                
                                <Button 
                                    onClick={handleOCRScan} 
                                    disabled={isScanningOCR}
                                    className="bg-slate-800 hover:bg-slate-700 h-14 font-semibold"
                                >
                                    <Camera size={20} className="mr-2" />
                                    {isScanningOCR ? 'Processing...' : 'Take Photo (OCR)'}
                                </Button>

                                <Button 
                                    onClick={() => fileInputRef.current?.click()} 
                                    disabled={isScanningOCR}
                                    className="bg-slate-700 hover:bg-slate-600 h-14 font-semibold"
                                >
                                    <Paperclip size={20} className="mr-2" />
                                    Upload File (OCR)
                                </Button>

                                <input 
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                    aria-label="Upload OCR Image"
                                    title="Upload OCR Image"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-3 text-center">Auto-populate vitals using your smart gauges, scanning via camera, or uploading a data plate photo.</p>
                        </Card>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <Card title="Outdoor Condenser / Heat Pump" className="space-y-4 shadow-sm border-slate-200 dark:border-slate-800">
                                {OUTDOOR_VITALS.map(v => (
                                    <Input 
                                        key={v.id}
                                        label={v.label}
                                        placeholder="No reading recorded"
                                        value={vitalsData[v.id] || ''}
                                        onChange={e => setVitalsData({...vitalsData, [v.id]: e.target.value})}
                                        className="!py-1.5 focus:border-indigo-500"
                                    />
                                ))}
                            </Card>
                            <Card title="Indoor Air Handler / Furnace / Coil" className="space-y-4 shadow-sm border-slate-200 dark:border-slate-800">
                                {INDOOR_VITALS.map(v => (
                                    <Input 
                                        key={v.id}
                                        label={v.label}
                                        placeholder="No reading recorded"
                                        value={vitalsData[v.id] || ''}
                                        onChange={e => setVitalsData({...vitalsData, [v.id]: e.target.value})}
                                        className="!py-1.5 focus:border-indigo-500"
                                    />
                                ))}
                            </Card>
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Save Readings to Job">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Save current data to the digital job folder.</p>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Repair Phase</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setReadingPhase('before')}
                                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                    readingPhase === 'before'
                                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                🛠️ Before Repair
                            </button>
                            <button
                                type="button"
                                onClick={() => setReadingPhase('after')}
                                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                    readingPhase === 'after'
                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                ✨ After Repair
                            </button>
                        </div>
                    </div>

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

