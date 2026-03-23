
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
        if (!state.currentOrganization) return;

        const vehicleToSave: Vehicle = {
            ...currentVehicle,
            id: currentVehicle.id || `veh-${Date.now()}`,
            organizationId: state.currentOrganization.id,
            make: currentVehicle.make || '',
            model: currentVehicle.model || '',
            year: Number(currentVehicle.year),
            licensePlate: currentVehicle.licensePlate || '',
            vin: currentVehicle.vin,
            barcode: currentVehicle.barcode,
            assignedUserId: currentVehicle.assignedUserId
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

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Fleet Management</h3>
                    <p className="text-gray-500">Manage company vehicles and assignments.</p>
                </div>
                <Button onClick={() => { setCurrentVehicle({ year: new Date().getFullYear() }); setIsModalOpen(true); }} className="w-auto flex items-center gap-2">
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
                                    <div className="font-bold text-gray-900 dark:text-white">{v.year} {v.make} {v.model}</div>
                                </td>
                                <td className="px-6 py-4 text-sm font-mono uppercase bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded w-fit">{v.licensePlate}</td>
                                <td className="px-6 py-4 text-xs text-gray-500">
                                    <div>VIN: {v.vin || '-'}</div>
                                    <div>Tag: {v.barcode || '-'}</div>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : <span className="text-gray-400 italic">Unassigned</span>}
                                </td>
                                <td className="px-6 py-4 flex gap-2">
                                    <button onClick={() => handleEdit(v)} className="text-blue-500 hover:text-blue-700"><Edit size={16}/></button>
                                    <button onClick={() => handleDelete(v.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
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
                    <Input label="Barcode / Tag ID" value={currentVehicle.barcode || ''} onChange={e => setCurrentVehicle({...currentVehicle, barcode: e.target.value})} placeholder="Scan Tag ID..." />
                    
                    <Select label="Assigned Driver" value={currentVehicle.assignedUserId || ''} onChange={e => setCurrentVehicle({...currentVehicle, assignedUserId: e.target.value})}>
                        <option value="">-- Unassigned --</option>
                        {employees.map(u => (
                            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                        ))}
                    </Select>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Vehicle</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default FleetManager;
