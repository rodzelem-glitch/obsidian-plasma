import React, { useState, useEffect } from 'react';
import { Wifi, Thermometer, Wind, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface IoTDeviceData {
    id: string;
    brand: 'Nest' | 'Ecobee' | 'Honeywell' | 'Unknown';
    name: string;
    status: 'online' | 'offline';
    lastConnection: Date;
    temperature: number;
    humidity: number;
    mode: 'cool' | 'heat' | 'auto' | 'off';
    activeFaults: {
        code: string;
        description: string;
        severity: 'critical' | 'warning' | 'info';
    }[];
}

interface Props {
    jobId: string;
    customerName: string;
    orgId?: string;
}

const IoTDiagnosticsViewer: React.FC<Props> = ({ jobId, customerName, orgId }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const [devices, setDevices] = useState<IoTDeviceData[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleScan = async () => {
        setIsScanning(true);
        setErrorMsg(null);
        
        try {
            const functions = getFunctions();
            const fetchIotDiagnostics = httpsCallable(functions, 'fetchIotDiagnostics');
            
            const result = await fetchIotDiagnostics({ 
                orgId, 
                customerData: { name: customerName, jobId } 
            });
            
            const data = result.data as any;
            if (data && data.devices) {
                setDevices(data.devices);
            } else {
                setDevices([]);
            }
        } catch (e: any) {
            console.error("IoT Scan Failed:", e);
            setErrorMsg(e.message || "An error occurred while connecting to the smart home APIs.");
            setDevices([]);
        } finally {
            setIsScanning(false);
            setHasScanned(true);
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                        <Wifi size={14} className={isScanning ? 'text-primary-500 animate-pulse' : 'text-slate-400'}/>
                        Property IoT Devices
                    </h4>
                    <p className="text-xs text-slate-500">Scan smart home network for registered thermostats and leak detectors to read trouble codes natively.</p>
                </div>
                {!isScanning && (
                    <Button variant="secondary" size="sm" onClick={handleScan} className="text-[10px] uppercase font-black tracking-widest flex items-center gap-2 whitespace-nowrap">
                        <RefreshCw size={12} className={hasScanned ? '' : 'animate-spin opacity-50'}/> 
                        {hasScanned ? 'Rescan Network' : 'Scan Devices'}
                    </Button>
                )}
            </div>

            {isScanning ? (
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-8 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-700">
                    <Wifi size={32} className="text-primary-500 animate-ping mb-4" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest animate-pulse">Establishing secure handshake to device network...</p>
                </div>
            ) : hasScanned ? (
                devices.length > 0 ? (
                    <div className="space-y-4">
                        {devices.map(device => (
                            <div key={device.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm overflow-hidden relative">
                                {/* Background accent */}
                                <div className={`absolute top-0 right-0 w-32 h-32 -mr-10 -mt-10 rounded-full blur-3xl opacity-20 pointer-events-none ${device.activeFaults.length > 0 ? 'bg-red-500' : 'bg-primary-500'}`}></div>
                                
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl text-white ${device.brand === 'Nest' ? 'bg-amber-600' : device.brand === 'Ecobee' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                                            <Thermometer size={20} />
                                        </div>
                                        <div>
                                            <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{device.brand} Smart Thermostat</h5>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"><CheckCircle2 size={10}/> Online</span>
                                                <span className="text-[9px] text-slate-400 uppercase font-mono">{device.name}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className="text-center px-3 border-r border-slate-200 dark:border-slate-700">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Curr Temp</p>
                                            <p className="text-lg font-black text-slate-800 dark:text-white">{device.temperature}°</p>
                                        </div>
                                        <div className="text-center px-3 border-r border-slate-200 dark:border-slate-700">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Humidity</p>
                                            <p className="text-lg font-black text-slate-800 dark:text-white">{device.humidity}%</p>
                                        </div>
                                        <div className="text-center pl-3">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mode</p>
                                            <div className="flex items-center justify-center gap-1 mt-1 text-primary-500">
                                                <Wind size={16}/>
                                                <p className="text-xs font-black uppercase tracking-tighter text-slate-800 dark:text-white">{device.mode}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative z-10">
                                    <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><AlertTriangle size={12}/> Diagnostic Codes & Faults</h6>
                                    {device.activeFaults.length > 0 ? (
                                        <div className="space-y-2">
                                            {device.activeFaults.map(fault => (
                                                <div key={fault.code} className={`flex items-start gap-3 p-3 rounded-xl border ${fault.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'}`}>
                                                    <ShieldAlert size={16} className={`mt-0.5 ${fault.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                                                    <div>
                                                        <p className={`text-[11px] font-black uppercase tracking-widest mb-0.5 ${fault.severity === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>Error Code {fault.code}</p>
                                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed">{fault.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-700 dark:text-emerald-400">
                                            <CheckCircle2 size={16} />
                                            <p className="text-xs font-bold">No active faults or error codes reported by the device.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-8 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-700 text-center">
                        <AlertTriangle size={32} className={`${errorMsg ? 'text-red-400' : 'text-slate-400'} mb-4`} />
                        <p className={`text-sm font-bold ${errorMsg ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                            {errorMsg ? "Connection Error" : "No compatible IoT devices detected."}
                        </p>
                        <p className="text-xs text-slate-500 mt-2 max-w-md">
                            {errorMsg ? errorMsg : "The property network was scanned but neither Nest, Ecobee, nor Honeywell devices authorized to this platform were found."}
                        </p>
                    </div>
                )
            ) : (
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-2xl p-8 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-700 text-center opacity-70">
                    <Thermometer size={32} className="text-slate-400 mb-4" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Awaiting Scan Initiation...</p>
                </div>
            )}
        </div>
    );
};

export default IoTDiagnosticsViewer;
