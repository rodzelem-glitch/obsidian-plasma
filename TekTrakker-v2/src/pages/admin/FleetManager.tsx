
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import type { Vehicle, User } from 'types';
import { Truck, Edit, Trash2, Plus } from 'lucide-react';
import Select from 'components/ui/Select';
import { useSearchParams } from 'react-router-dom';
import { globalConfirm } from "lib/globalConfirm";

const FleetManager: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [searchParams] = useSearchParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    useEffect(() => {
        const query = searchParams.get('search');
        if (query) setSearchTerm(query);
    }, [searchParams]);

    const [currentVehicle, setCurrentVehicle] = useState<Partial<Vehicle>>({
        make: '', model: '', year: new Date().getFullYear(), licensePlate: '', vin: '', barcode: '', assignedUserId: ''
    });

    const employees = useMemo(() => state.users.filter(u => 
        u.organizationId === state.currentOrganization?.id && 
        (u.role === 'employee' || u.role === 'both' || u.role === 'supervisor' || u.role === 'Technician' || u.role === 'Subcontractor')
    ), [state.users, state.currentOrganization]);

    const vehicles = state.vehicles;

    const filteredVehicles = useMemo(() => {
        if (!vehicles) return [];
        return vehicles.filter(v => 
            (v.licensePlate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (v.make || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (v.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (v.barcode || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [vehicles, searchTerm]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!state.currentOrganization || isSaving) return;
        setIsSaving(true);

        const vehicleToSave: Vehicle = {
            ...currentVehicle,
            id: currentVehicle.id || `veh-${Date.now()}`,
            organizationId: state.currentOrganization.id,
            make: currentVehicle.make || '',
            model: currentVehicle.model || '',
            year: Number(currentVehicle.year),
            licensePlate: currentVehicle.licensePlate || '',
            vin: currentVehicle.vin || '',
            barcode: currentVehicle.barcode || '',
            assignedUserId: currentVehicle.assignedUserId || '',
            maintenanceInterval: currentVehicle.maintenanceInterval ? Number(currentVehicle.maintenanceInterval) : undefined,
            lastServiceMileage: currentVehicle.lastServiceMileage ? Number(currentVehicle.lastServiceMileage) : undefined,
        };

        try {
            if (currentVehicle.id) {
                await db.collection('vehicles').doc(vehicleToSave.id).update(vehicleToSave);
                dispatch({ type: 'UPDATE_VEHICLE', payload: vehicleToSave });
            } else {
                await db.collection('vehicles').doc(vehicleToSave.id).set(vehicleToSave);
                dispatch({ type: 'ADD_VEHICLE', payload: vehicleToSave });
            }
            setIsModalOpen(false);
            setCurrentVehicle({ make: '', model: '', year: new Date().getFullYear(), licensePlate: '', vin: '', barcode: '', assignedUserId: '' });
        } catch (error) {
            console.error(error);
            alert("Failed to save vehicle.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (v: Vehicle) => {
        setCurrentVehicle(v);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (await globalConfirm("Delete this vehicle?")) {
            await db.collection('vehicles').doc(id).delete();
            dispatch({ type: 'DELETE_VEHICLE', payload: id });
        }
    };

    const [viewingLogVehicle, setViewingLogVehicle] = useState<Vehicle | null>(null);

    const vehicleLogsForViewing = useMemo(() => {
        if (!viewingLogVehicle) return [];
        return state.vehicleLogs.filter(log => 
            log.isCompanyVehicle && 
            (log.vehicleId === viewingLogVehicle.id || log.userId === viewingLogVehicle.assignedUserId)
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.vehicleLogs, viewingLogVehicle]);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Fleet Management</h3>
                    <p className="text-gray-500">Manage company vehicles and assignments.</p>
                </div>
                <Button onClick={() => { 
                    setCurrentVehicle({ make: '', model: '', year: new Date().getFullYear(), licensePlate: '', vin: '', barcode: '', assignedUserId: '' }); 
                    setIsModalOpen(true); 
                }} className="w-auto flex items-center gap-2">
                    <Plus size={16}/> Add Vehicle
                </Button>
            </header>

            <div className="flex gap-4">
                <Input placeholder="Search Plate, Make, or Barcode..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-md"/>
            </div>

            <Card>
                <Table headers={['Vehicle', 'License Plate', 'VIN / ID', 'Assigned To', 'Actions']}>
                    {filteredVehicles.map(v => {
                        const assignedUser = employees.find(u => u.id === v.assignedUserId);
                        return (
                            <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        {v.year} {v.make} {v.model}
                                        {v.maintenanceInterval && v.lastServiceMileage !== undefined && (() => {
                                            const latestLog = state.vehicleLogs
                                                .filter(log => log.vehicleId === v.id || (v.assignedUserId && log.userId === v.assignedUserId))
                                                .reduce((max, log) => Math.max(max, log.endMileage || 0), 0);
                                            const isDue = (latestLog - v.lastServiceMileage) >= v.maintenanceInterval;
                                            return isDue && latestLog > 0 ? (
                                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider title='Maintenance Due'">Due</span>
                                            ) : null;
                                        })()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-mono uppercase">
                                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded hidden md:inline-block">{v.licensePlate}</span>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-500">
                                    <div>VIN: {v.vin || '-'}</div>
                                    <div>Tag: {v.barcode || '-'}</div>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : <span className="text-gray-400 italic">Unassigned</span>}
                                </td>
                                <td className="px-6 py-4 flex flex-wrap gap-3 items-center">
                                    <button onClick={() => setViewingLogVehicle(v)} className="text-emerald-500 hover:text-emerald-700 flex items-center gap-1 text-xs font-bold" title="View Logs & Maintenance">
                                        Logs
                                    </button>
                                    <button onClick={() => handleEdit(v)} className="text-blue-500 hover:text-blue-700" title="Edit Vehicle"><Edit size={16}/></button>
                                    <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-700" title="Delete Vehicle"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredVehicles.length === 0 && <tr><td colSpan={5} className="p-4 md:p-8 text-center text-gray-500">No vehicles found.</td></tr>}
                </Table>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentVehicle.id ? "Edit Vehicle" : "Add Vehicle"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input label="Year" type="number" value={currentVehicle.year} onChange={e => setCurrentVehicle({...currentVehicle, year: parseInt(e.target.value)})} required />
                        <Input label="Make" value={currentVehicle.make} onChange={e => setCurrentVehicle({...currentVehicle, make: e.target.value})} required />
                        <Input label="Model" value={currentVehicle.model} onChange={e => setCurrentVehicle({...currentVehicle, model: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="License Plate" value={currentVehicle.licensePlate} onChange={e => setCurrentVehicle({...currentVehicle, licensePlate: e.target.value})} required />
                        <Input label="VIN" value={currentVehicle.vin || ''} onChange={e => setCurrentVehicle({...currentVehicle, vin: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Barcode / Tag ID" value={currentVehicle.barcode || ''} onChange={e => setCurrentVehicle({...currentVehicle, barcode: e.target.value})} placeholder="Scan Tag ID..." />
                        <Select label="Assigned Driver" value={currentVehicle.assignedUserId || ''} onChange={e => setCurrentVehicle({...currentVehicle, assignedUserId: e.target.value})}>
                            <option value="">-- Unassigned --</option>
                            {employees.map(u => (
                                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="border-t pt-4 mt-2">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Maintenance Tracking</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Service Interval (Miles)" type="number" value={currentVehicle.maintenanceInterval || ''} onChange={e => setCurrentVehicle({...currentVehicle, maintenanceInterval: parseInt(e.target.value)})} placeholder="e.g. 5000" />
                            <Input label="Last Service (Odometer)" type="number" value={currentVehicle.lastServiceMileage || ''} onChange={e => setCurrentVehicle({...currentVehicle, lastServiceMileage: parseInt(e.target.value)})} placeholder="e.g. 45000" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="w-auto">Cancel</Button>
                        <Button type="submit" disabled={isSaving} className="w-auto">{isSaving ? 'Saving...' : 'Save Vehicle'}</Button>
                    </div>
                </form>
            </Modal>

            {viewingLogVehicle && (
                <Modal isOpen={!!viewingLogVehicle} onClose={() => setViewingLogVehicle(null)} title={`Records: ${viewingLogVehicle.year} ${viewingLogVehicle.make} ${viewingLogVehicle.licensePlate}`} size="xl">
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3">
                            <Truck className="text-blue-600 mt-1"/>
                            <div>
                                <h4 className="font-bold text-blue-900 dark:text-blue-300">Vehicle Logs & Maintenance</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-400">These logs are submitted by the technician assigned to this vehicle.</p>
                            </div>
                        </div>

                        {vehicleLogsForViewing.length === 0 ? (
                            <p className="text-center p-8 text-gray-500 border border-dashed rounded-lg">No logs are currently associated with this vehicle or its assigned driver.</p>
                        ) : (
                            <div className="space-y-3">
                                {vehicleLogsForViewing.map(log => (
                                    <div key={log.id} className="p-4 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-900 dark:text-white">{log.date}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${log.type === 'Fuel' ? 'bg-orange-100 text-orange-700' : log.type === 'Maintenance' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{log.type}</span>
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                {log.type === 'Mileage' ? `Recorded Mileage: ${log.startMileage || '-'} to ${log.endMileage || '-'} (${log.mileage || 0} mi)` : `Cost: $${(log.cost || 0).toFixed(2)}`}
                                            </div>
                                            {log.notes && <div className="text-xs text-gray-500 italic mt-1">"{log.notes}"</div>}
                                        </div>
                                            <div className="flex items-center gap-3">
                                                {log.receiptData && (
                                                    <a href={log.receiptData} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">Receipt</a>
                                                )}
                                                <button 
                                                    onClick={async () => {
                                                        if (await globalConfirm("Delete this log?")) {
                                                            await db.collection('vehicleLogs').doc(log.id).delete();
                                                            dispatch({ type: 'DELETE_VEHICLE_LOG', payload: log.id });
                                                        }
                                                    }} 
                                                    className="text-xs text-red-600 hover:underline"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FleetManager;
