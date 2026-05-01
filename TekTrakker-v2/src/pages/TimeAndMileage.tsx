import showToast from "lib/toast";
import React, { useState, useEffect, useMemo } from 'react';
import type { User, ShiftLog, VehicleLog, ShiftEdit, StoredFile } from 'types';
import Card from 'components/ui/Card';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import { FuelIcon, WrenchScrewdriverIcon, DocumentTextIcon, MapPinIcon, Download } from '@constants';
import { Edit, Trash2, Paperclip, CheckCircle, Printer, Camera as CameraIcon } from 'lucide-react';
import { useAppContext } from 'context/AppContext';
import Modal from 'components/ui/Modal';
import Toggle from 'components/ui/Toggle';
import Textarea from 'components/ui/Textarea';
import { useNavigate } from 'react-router-dom';
import { db } from 'lib/firebase';
import { globalConfirm } from "lib/globalConfirm";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { getCurrentLocation } from 'lib/geolocation';
import { uploadFileToStorage } from 'lib/storageService';

const TimeAndMileage: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const { currentUser: user } = state;
    
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    
    // State for Log Form
    const [newVehicleLog, setNewVehicleLog] = useState({ 
        type: 'Mileage' as 'Fuel' | 'Maintenance' | 'Mileage', 
        cost: '', 
        miles: '', // Calculated Total
        startMiles: '', // IRS Start
        endMiles: '', // IRS End
        notes: '', 
        id: '' 
    });
    
    const [isCompanyVehicle, setIsCompanyVehicle] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [capturedReceiptData, setCapturedReceiptData] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    
    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
    const [printHtmlContent, setPrintHtmlContent] = useState<string | null>(null);

    // Auto-Calculate Total Miles when Start/End change
    useEffect(() => {
        if (newVehicleLog.type === 'Mileage') {
            let start = parseFloat(newVehicleLog.startMiles);
            const end = parseFloat(newVehicleLog.endMiles);
            
            // If start is not typed, check for a pending start log
            if (isNaN(start) && !isNaN(end)) {
                const pending = [...state.vehicleLogs]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .find(l => l.userId === user?.id && l.type === 'Mileage' && l.isCompanyVehicle === isCompanyVehicle && l.startMileage && !l.endMileage);
                if (pending && pending.startMileage) {
                    start = pending.startMileage;
                }
            }

            if (!isNaN(start) && !isNaN(end) && end >= start) {
                const calcMiles = (end - start).toFixed(1);
                if (newVehicleLog.miles !== calcMiles) {
                    setNewVehicleLog(prev => ({...prev, miles: calcMiles }));
                }
            }
        }
    }, [newVehicleLog.startMiles, newVehicleLog.endMiles, newVehicleLog.type, state.vehicleLogs, user?.id, isCompanyVehicle]);

    // Set default vehicle status based on user profile
    useEffect(() => {
        if (user) {
            setIsCompanyVehicle(user.hasCompanyVehicle || false);
        }
    }, [user]);

    const userShiftLogs = useMemo(() => {
      if (!user) return [];
      const logs = (state.shiftLogs[user.id] || []).sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
      return logs;
    }, [state.shiftLogs, user]);

    // Sort vehicle logs newest first
    const sortedVehicleLogs = useMemo(() => {
        return [...state.vehicleLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.vehicleLogs]);

    const personalLogs = useMemo(() => {
        if (!user) return [];
        return sortedVehicleLogs.filter(log => log.userId === user.id && !log.isCompanyVehicle);
    }, [sortedVehicleLogs, user]);

    // Optimized activeShift detection
    const activeShift = useMemo(() => {
        return userShiftLogs.find(log => !log.clockOut);
    }, [userShiftLogs]);

    useEffect(() => {
        let interval: number;
        if (activeShift) {
            interval = window.setInterval(() => {
                const diff = new Date().getTime() - new Date(activeShift.clockIn).getTime();
                const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
                const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                setElapsedTime(`${h}:${m}:${s}`);
            }, 1000);
        } else {
            setElapsedTime('00:00:00');
        }
        return () => clearInterval(interval);
    }, [activeShift]);


    const handleClockIn = async () => {
        if (state.isDemoMode) {
            showToast.warn("This feature is disabled in demo mode.");
            return;
        }
        const activeOrgId = state.currentOrganization?.id || user?.organizationId;
        if (!user || !activeOrgId) {
            showToast.warn("Session error. Please log in again.");
            return;
        }

        const loc = await getCurrentLocation();
        const logId = `shift-${Date.now()}`;
        const newLog: ShiftLog = { 
            id: logId, 
            organizationId: activeOrgId,
            clockIn: new Date().toISOString(), 
            userId: user.id,
            startLocation: loc ? { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy } : undefined
        };

        try {
            await db.collection('shiftLogs').doc(logId).set(newLog);
            dispatch({ type: 'ADD_SHIFT_LOG', payload: { userId: user.id, log: newLog } });
            setSaveFeedback('Clocked In!');
            setTimeout(() => setSaveFeedback(null), 3000);
        } catch (e) {
            console.error(e);
            showToast.warn("Clock-in failed.");
        }
    };

    const handleClockOut = async () => {
        if (state.isDemoMode) {
            showToast.warn("This feature is disabled in demo mode.");
            return;
        }
        if (activeShift && user) {
            const loc = await getCurrentLocation();
            const updatedLog = { 
                ...activeShift, 
                clockOut: new Date().toISOString(),
                endLocation: loc ? { lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy } : undefined
            };
            try {
                await db.collection('shiftLogs').doc(activeShift.id).update(updatedLog);
                dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: user.id, log: updatedLog } });
                setSaveFeedback('Clocked Out!');
                setTimeout(() => setSaveFeedback(null), 3000);
            } catch (e) {
                console.error(e);
                showToast.warn("Clock-out failed.");
            }
        }
    };

    const handleVehicleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (state.isDemoMode) {
            showToast.warn("This feature is disabled in demo mode.");
            return;
        }
        if (!user) return;
        
        const activeOrgId = state.currentOrganization?.id || user.organizationId;
        if (!activeOrgId) {
            showToast.warn("Organization context missing.");
            return;
        }

        if (newVehicleLog.type === 'Mileage' && !newVehicleLog.startMiles && !newVehicleLog.endMiles && !newVehicleLog.miles) {
            showToast.warn("Please enter either the odometer reading or the total miles driven.");
            return;
        }

        setUploading(true);

        try {
            const loc = await getCurrentLocation();
            
            let effectiveIsEditMode = isEditMode;
            let targetLogId = newVehicleLog.id || `vl-${Date.now()}`;
            let existingLog: VehicleLog | undefined;
            let effectiveStartMiles = newVehicleLog.startMiles;
            let effectiveEndMiles = newVehicleLog.endMiles;
            let effectiveMiles = newVehicleLog.miles;
            
            if (!effectiveIsEditMode && newVehicleLog.type === 'Mileage' && effectiveEndMiles && !effectiveStartMiles && !effectiveMiles) {
                // Auto-combine start/end logs if they are submitting an end-only log
                const pending = [...state.vehicleLogs]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .find(l => l.userId === user.id && l.type === 'Mileage' && l.isCompanyVehicle === isCompanyVehicle && l.startMileage && !l.endMileage);
                    
                if (pending) {
                    effectiveIsEditMode = true;
                    targetLogId = pending.id;
                    existingLog = pending;
                    
                    effectiveStartMiles = pending.startMileage!.toString();
                    const parsedStart = pending.startMileage || 0;
                    const parsedEnd = parseFloat(effectiveEndMiles);
                    if (!isNaN(parsedEnd) && parsedEnd >= parsedStart) {
                        effectiveMiles = (parsedEnd - parsedStart).toFixed(1);
                    }
                }
            } else if (effectiveIsEditMode) {
                existingLog = state.vehicleLogs.find(l => l.id === targetLogId);
            }

            let receiptUrlValue: string | null = existingLog?.receiptUrl || null;
            let receiptDataValue: string | null = existingLog?.receiptData || null;

            if (capturedReceiptData) {
                const path = `organizations/${activeOrgId}/users/${user.id}/receipts/${Date.now()}_capture.jpg`;
                receiptUrlValue = await uploadFileToStorage(path, capturedReceiptData);
                receiptDataValue = null;
            } else if (receiptFile) {
                const safeName = receiptFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
                const path = `organizations/${activeOrgId}/users/${user.id}/receipts/${Date.now()}_${safeName}`;
                receiptUrlValue = await uploadFileToStorage(path, receiptFile);
                receiptDataValue = null;
            }
            
            let finalStartTime = existingLog?.startTime;
            let finalStartLocation = existingLog?.startLocation;
            let finalEndTime = existingLog?.endTime;
            let finalEndLocation = existingLog?.endLocation;

            const nowIso = new Date().toISOString();
            const mappedLoc = loc ? { lat: loc.latitude, lng: loc.longitude } : undefined;

            const companyVehicle = isCompanyVehicle 
                ? state.vehicles.find(v => v.assignedUserId === user.id) 
                : null;
            const assignedVehicleId = isCompanyVehicle ? (companyVehicle ? companyVehicle.id : `unassigned-${user.id}`) : 'personal';

            if (!effectiveIsEditMode) {
                if (effectiveStartMiles) {
                    finalStartTime = nowIso;
                    finalStartLocation = mappedLoc;
                }
                if (effectiveEndMiles) {
                    finalEndTime = nowIso;
                    finalEndLocation = mappedLoc;
                }
            } else {
                if (effectiveStartMiles && !existingLog?.startMileage) {
                    finalStartTime = nowIso;
                    finalStartLocation = mappedLoc;
                }
                if (effectiveEndMiles && !existingLog?.endMileage) {
                    finalEndTime = nowIso;
                    finalEndLocation = mappedLoc;
                }
            }

            const log: VehicleLog = {
                id: targetLogId,
                organizationId: activeOrgId,
                vehicleId: assignedVehicleId,
                userId: user.id,
                date: effectiveIsEditMode && existingLog ? existingLog.date : nowIso.split('T')[0],
                startTime: finalStartTime,
                endTime: finalEndTime,
                type: newVehicleLog.type,
                cost: parseFloat(newVehicleLog.cost) || 0,
                mileage: parseFloat(effectiveMiles) || 0,
                startMileage: parseFloat(effectiveStartMiles) || 0, 
                endMileage: parseFloat(effectiveEndMiles) || 0,
                isCompanyVehicle: isCompanyVehicle,
                notes: newVehicleLog.notes,
                receiptData: receiptDataValue, 
                receiptUrl: receiptUrlValue,
                location: existingLog?.location || mappedLoc,
                startLocation: finalStartLocation,
                endLocation: finalEndLocation
            };

            const safeLog = Object.fromEntries(Object.entries(log).filter(([_, v]) => v !== undefined)) as any;

            if (effectiveIsEditMode) {
                await db.collection('vehicleLogs').doc(log.id).update(safeLog);
                dispatch({ type: 'UPDATE_VEHICLE_LOG', payload: log });
            } else {
                await db.collection('vehicleLogs').doc(log.id).set(safeLog);
                dispatch({ type: 'ADD_VEHICLE_LOG', payload: log });
            }

            setNewVehicleLog({ type: 'Mileage', cost: '', miles: '', startMiles: '', endMiles: '', notes: '', id: '' });
            setReceiptFile(null);
            setCapturedReceiptData(null);
            setIsEditMode(false);
            setSaveFeedback('Log Saved!');
            setTimeout(() => setSaveFeedback(null), 3000);
        } catch (e) {
            console.error(e);
            showToast.warn("Error saving log: " + (e as any).message);
        } finally {
            setUploading(false);
        }
    };

    const handleEditVehicleLog = (log: VehicleLog) => {
        setNewVehicleLog({ 
            id: log.id, 
            type: log.type, 
            cost: log.cost ? log.cost.toString() : '0', 
            miles: log.mileage ? log.mileage.toString() : '',
            startMiles: log.startMileage ? log.startMileage.toString() : '',
            endMiles: log.endMileage ? log.endMileage.toString() : '',
            notes: log.notes || ''
        });
        setIsCompanyVehicle(log.isCompanyVehicle ?? false);
        setIsEditMode(true);
        setTimeout(() => {
            document.getElementById('log-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleDeleteVehicleLog = async (id: string) => {
        if (state.isDemoMode) {
            showToast.warn("This feature is disabled in demo mode.");
            return;
        }
        if (await globalConfirm('Delete log?')) {
            try {
                await db.collection('vehicleLogs').doc(id).delete();
                dispatch({ type: 'DELETE_VEHICLE_LOG', payload: id });
            } catch (e) {
                console.error(e);
                showToast.warn("Delete failed.");
            }
        }
    };

    const handleViewReceipt = (log: VehicleLog) => {
        if (log.receiptUrl) {
            setViewingReceipt(log.receiptUrl);
        } else if (log.receiptData) {
            setViewingReceipt(log.receiptData);
        } else {
            showToast.warn('Receipt not available.');
        }
    };

    const handlePrintPersonalLogs = () => {
        if (!user) return;
        
        const html = `
            <html>
            <head>
                <title>Personal Vehicle Logs - ${user.firstName} ${user.lastName}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    h1 { margin-bottom: 5px; }
                    .meta { color: #666; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { text-align: left; background: #f4f4f4; border: 1px solid #ddd; padding: 12px; font-size: 12px; }
                    td { border: 1px solid #ddd; padding: 12px; font-size: 13px; }
                </style>
            </head>
            <body>
                <h1>Personal Vehicle Records</h1>
                <div class="meta">Owner: ${user.firstName} ${user.lastName} | Exported: ${new Date().toLocaleDateString()}</div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Odometer (Start-End)</th>
                            <th>Mileage</th>
                            <th>Cost</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${personalLogs.map(log => `
                            <tr>
                                <td>${log.date}</td>
                                <td>${log.type}</td>
                                <td>${log.startMileage || '-'}-${log.endMileage || '-'}</td>
                                <td>${log.mileage || '-'} mi</td>
                                <td>$${log.cost.toFixed(2)}</td>
                                <td>${log.notes}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        // setTimeout(function() { window.print(); }, 500);
                    };
                </script>
            </body>
            </html>
        `;
        setPrintHtmlContent(html);
    };

    if (!user) return null;

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-20">
            {saveFeedback && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce font-bold">
                    <CheckCircle size={20}/> {saveFeedback}
                </div>
            )}

            <header className="flex justify-between items-start">
                
                <div className="flex gap-2">
                    <Button onClick={handlePrintPersonalLogs} variant="secondary" className="w-auto flex items-center gap-2 text-xs font-bold border-slate-200">
                        <Printer size={16} /> Print Personal Logs
                    </Button>
                    <Button onClick={() => navigate('/briefing')} className="w-auto bg-gray-600 hover:bg-gray-500 flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5" />
                        Briefing
                    </Button>
                </div>
            </header>
            
            <Card>
                 <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-4">Current Shift Status</h3>
                 <div className="text-center">
                    {!!activeShift ? (
                        <div>
                            <p className="text-4xl font-mono text-gray-900 dark:text-white mb-2">{elapsedTime}</p>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Clocked in at {new Date(activeShift.clockIn).toLocaleTimeString()}</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-4xl font-mono text-gray-400 dark:text-gray-500 mb-2">Not Clocked In</p>
                        </div>
                    )}
                    <div className="flex gap-4 mt-6 justify-center">
                        <Button onClick={handleClockIn} disabled={!!activeShift} className="w-40 bg-green-600 hover:bg-green-700 shadow-lg">Clock In</Button>
                        <Button onClick={handleClockOut} disabled={!activeShift} className="w-40 bg-red-600 hover:bg-red-700 shadow-lg">Clock Out</Button>
                    </div>
                 </div>
            </Card>

            <Modal isOpen={!!viewingReceipt} onClose={() => setViewingReceipt(null)} title="Receipt View">
                {viewingReceipt && <img src={viewingReceipt} alt="Receipt" className="w-full h-auto rounded" />}
                <div className="mt-4 flex justify-end">
                    <Button onClick={() => setViewingReceipt(null)}>Close</Button>
                </div>
            </Modal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Weekly Mileage</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{(state.vehicleLogs.filter(l => l.type === 'Mileage' && l.userId === user.id).reduce((sum, l) => sum + (l.mileage || 0), 0)).toFixed(1)} <span className="text-sm font-normal text-gray-500">mi</span></p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Total Recorded</p>
                </Card>
                <Card className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                    <p className="text-xs font-bold text-green-600 dark:text-blue-400 uppercase">Expense Total</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${(state.vehicleLogs.filter(l => l.type !== 'Mileage' && l.userId === user.id).reduce((sum, l) => sum + (l.cost || 0), 0)).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Current Period</p>
                </Card>
            </div>

            <Card id="log-form-container" className={`transition-all duration-300 ${isEditMode ? 'ring-2 ring-amber-500 dark:ring-amber-400 bg-amber-50/10 dark:bg-amber-900/10 shadow-lg shadow-amber-500/20' : ''}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400">{isEditMode ? 'Edit Log' : 'Mileage & Expenses'}</h3>
                    {isEditMode && <button onClick={() => {setIsEditMode(false); setNewVehicleLog({type:'Mileage', cost:'', miles:'', startMiles: '', endMiles: '', notes:'', id:''}); setReceiptFile(null); setCapturedReceiptData(null)}} className="text-xs text-red-700 dark:text-red-400 font-bold hover:underline">Cancel Edit</button>}
                </div>
                
                <form onSubmit={handleVehicleLogSubmit} className="space-y-4 mb-6">
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={() => setNewVehicleLog({...newVehicleLog, type: 'Mileage'})} variant={newVehicleLog.type === 'Mileage' ? 'primary' : 'secondary'} className="flex-1 flex items-center justify-center gap-2"><MapPinIcon className="w-5 h-5"/>Mileage</Button>
                        <Button type="button" onClick={() => setNewVehicleLog({...newVehicleLog, type: 'Fuel'})} variant={newVehicleLog.type === 'Fuel' ? 'primary' : 'secondary'} className="flex-1 flex items-center justify-center gap-2"><FuelIcon className="w-5 h-5"/>Fuel</Button>
                        <Button type="button" onClick={() => setNewVehicleLog({...newVehicleLog, type: 'Maintenance'})} variant={newVehicleLog.type === 'Maintenance' ? 'primary' : 'secondary'} className="flex-1 flex items-center justify-center gap-2"><WrenchScrewdriverIcon className="w-5 h-5"/>Maint.</Button>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                        <Toggle 
                            label={isCompanyVehicle ? "Vehicle: Company Truck" : "Vehicle: Personal Car"} 
                            enabled={isCompanyVehicle} 
                            onChange={setIsCompanyVehicle} 
                        />
                    </div>

                    {newVehicleLog.type === 'Mileage' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input 
                                label="Starting Odometer" 
                                type="number" 
                                step="0.1" 
                                value={newVehicleLog.startMiles} 
                                onChange={e => setNewVehicleLog({...newVehicleLog, startMiles: e.target.value})} 
                                isBlock
                            />
                            <Input 
                                label="Ending Odometer" 
                                type="number" 
                                step="0.1" 
                                value={newVehicleLog.endMiles} 
                                onChange={e => setNewVehicleLog({...newVehicleLog, endMiles: e.target.value})} 
                                isBlock
                            />
                            <div className="col-span-1 md:col-span-2">
                                <Input 
                                    label="Total Miles (if Odometer unknown)" 
                                    type="number" 
                                    step="0.1" 
                                    value={newVehicleLog.miles} 
                                    onChange={e => setNewVehicleLog({...newVehicleLog, miles: e.target.value})} 
                                    isBlock
                                />
                            </div>
                        </div>
                    ) : (
                        <Input label="Cost ($)" type="number" step="0.01" value={newVehicleLog.cost} onChange={e => setNewVehicleLog({...newVehicleLog, cost: e.target.value})} required isBlock />
                    )}
                    
                    <Input label="Notes / Description" type="text" value={newVehicleLog.notes} onChange={e => setNewVehicleLog({...newVehicleLog, notes: e.target.value})} isBlock />
                    
                    {newVehicleLog.type !== 'Mileage' && (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">
                                {isEditMode ? 'Replace Receipt' : 'Upload Receipt'}
                            </label>
                            <div className="flex gap-2">
                                <Button 
                                    type="button" 
                                    variant="secondary"
                                    onClick={async () => {
                                        try {
                                            const image = await Camera.getPhoto({
                                                quality: 60,
                                                allowEditing: true,
                                                resultType: CameraResultType.Base64,
                                                source: CameraSource.Prompt
                                            });
                                            if (image.base64String) {
                                                const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
                                                setCapturedReceiptData(dataUrl);
                                                showToast.warn("Photo captured!");
                                            }
                                        } catch (e) {
                                            console.error("Camera Cancelled/Failed", e);
                                        }
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 py-2"
                                >
                                    <CameraIcon size={16} /> Take Photo
                                </Button>
                                <div className="relative flex-1">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={e => {
                                            setReceiptFile(e.target.files ? e.target.files[0] : null);
                                            setCapturedReceiptData(null);
                                        }}
                                        className="hidden"
                                        id="manual-file-upload"
                                        aria-label="Upload Receipt"
                                        title="Upload Receipt"
                                    />
                                    <Button 
                                        type="button" 
                                        variant="secondary" 
                                        onClick={() => document.getElementById('manual-file-upload')?.click()}
                                        className="w-full h-full flex items-center justify-center gap-2 py-2"
                                    >
                                        <Paperclip size={16} /> Choose File
                                    </Button>
                                </div>
                            </div>
                            {(receiptFile || capturedReceiptData) && (
                                <p className="text-xs text-green-600 font-medium">✓ Receipt ready: {receiptFile ? receiptFile.name : 'Photo Captured'}</p>
                            )}
                        </div>
                    )}
                    <Button type="submit" disabled={uploading}>{uploading ? 'Processing...' : (isEditMode ? 'Update Log' : 'Save Log')}</Button>
                </form>

                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                    <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 pt-4">Recent Entries</h4>
                    {sortedVehicleLogs.filter(l => l.userId === user.id).length > 0 ? sortedVehicleLogs.filter(l => l.userId === user.id).map(log => (
                        <div key={log.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex justify-between items-center border border-gray-200 dark:border-gray-700">
                           <div>
                             <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-800 dark:text-gray-200">{log.type}: {log.notes}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${log.isCompanyVehicle ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                                    {log.isCompanyVehicle ? 'Company' : 'Personal'}
                                </span>
                             </div>
                             <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                {log.date}
                                {log.startLocation && (
                                    <a href={`https://maps.google.com/?q=${log.startLocation.lat},${log.startLocation.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline ml-2" title={`Start time: ${log.startTime ? new Date(log.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown'}`}>
                                        <MapPinIcon className="w-3 h-3"/> Start
                                    </a>
                                )}
                                {log.endLocation && (
                                    <a href={`https://maps.google.com/?q=${log.endLocation.lat},${log.endLocation.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-600 hover:underline ml-2" title={`End time: ${log.endTime ? new Date(log.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Unknown'}`}>
                                        <MapPinIcon className="w-3 h-3"/> End
                                    </a>
                                )}
                                {(!log.startLocation && !log.endLocation && log.location) && (
                                    <a href={`https://maps.google.com/?q=${log.location.lat},${log.location.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gray-500 hover:underline ml-2">
                                        <MapPinIcon className="w-3 h-3"/> Location
                                    </a>
                                )}
                             </p>
                           </div>
                           <div className="flex flex-col items-end gap-1">
                               {log.type === 'Mileage' ? (
                                   <p className="font-bold text-gray-900 dark:text-white">{log.mileage} mi</p>
                               ) : (
                                   <p className="font-bold text-gray-900 dark:text-white">${log.cost.toFixed(2)}</p>
                               )}
                               <div className="flex gap-2 text-xs">
                                   {(log.receiptData || log.receiptUrl) && <button onClick={() => handleViewReceipt(log)} className="text-primary-600 dark:text-primary-400 hover:underline">Receipt</button>}
                                   <button onClick={() => handleEditVehicleLog(log)} className="text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
                                   <button onClick={() => handleDeleteVehicleLog(log.id)} className="text-red-600 dark:text-red-400 hover:underline">Del</button>
                               </div>
                           </div>
                        </div>
                    )) : <p className="text-sm text-gray-500 text-center py-4">No logs yet.</p>}
                 </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Shifts</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Start</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">End</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800/50 divide-y divide-gray-200 dark:divide-gray-700">
                            {userShiftLogs.slice(0, 10).map((log) => {
                                const start = new Date(log.clockIn);
                                const end = log.clockOut ? new Date(log.clockOut) : null;
                                const duration = end ? ((end.getTime() - start.getTime()) / 3600000).toFixed(2) + ' hrs' : 'Active';
                                const latestEdit = log.edits && log.edits.length > 0 ? log.edits[0] : null;
                                return (
                                    <React.Fragment key={log.id}>
                                        <tr className={latestEdit ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}>
                                            <td className="px-6 py-4 whitespace-normal min-w-[200px] text-sm text-gray-900 dark:text-white">
                                                {start.toLocaleDateString()}
                                                {latestEdit && (
                                                    <div className="mt-1 flex flex-col">
                                                        <span className="inline-flex items-center w-max max-w-full px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 shadow-sm border border-amber-200 dark:border-amber-700/50 break-words whitespace-normal" title={`Corrected by: ${latestEdit.adminName || 'Admin'}`}>
                                                            <span className="font-bold mr-1">Edited:</span> {latestEdit.reason || 'Admin adjustment'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary-600">{duration}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex gap-2">
                                                    {log.startLocation ? (
                                                        <a href={`https://maps.google.com/?q=${log.startLocation.lat},${log.startLocation.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline" title="View Clock-In Location">
                                                            <MapPinIcon className="w-3 h-3"/> In
                                                        </a>
                                                    ) : <span className="text-xs text-gray-400">No Location</span>}
                                                    {log.endLocation && (
                                                        <a href={`https://maps.google.com/?q=${log.endLocation.lat},${log.endLocation.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-600 hover:underline" title="View Clock-Out Location">
                                                            <MapPinIcon className="w-3 h-3"/> Out
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {latestEdit && (
                                            <tr className="bg-amber-50/50 dark:bg-amber-900/20">
                                                <td colSpan={5} className="px-6 py-2 text-xs text-amber-800 dark:text-amber-200/80 border-t border-amber-100 dark:border-amber-900/50">
                                                    <strong>Correction by {latestEdit.adminName || 'Admin'}:</strong> {latestEdit.reason}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
            {viewingReceipt && (
                <Modal isOpen={!!viewingReceipt} onClose={() => setViewingReceipt(null)} title="Receipt Viewer" size="xl">
                    <div className="flex justify-center bg-gray-100 p-4 rounded min-h-[50vh]">
                        <img src={viewingReceipt} alt="Receipt" className="max-w-full max-h-[70vh] object-contain rounded" />
                    </div>
                </Modal>
            )}

            {printHtmlContent && (
                <Modal isOpen={!!printHtmlContent} onClose={() => setPrintHtmlContent(null)} title="Print Preview" size="xl">
                    <div className="flex flex-col h-[75vh]">
                        <div className="flex-1 overflow-hidden bg-white rounded border border-slate-200">
                            <iframe 
                                srcDoc={printHtmlContent} 
                                className="w-full h-full border-0" 
                                title="Print Preview"
                                id="print-iframe"
                            />
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setPrintHtmlContent(null)} className="w-auto">Cancel</Button>
                            <Button onClick={() => {
                                const iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
                                if (iframe && iframe.contentWindow) {
                                    iframe.contentWindow.print();
                                }
                            }} className="w-auto">
                                <Printer size={18} className="mr-2" /> Print Document
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default TimeAndMileage;
