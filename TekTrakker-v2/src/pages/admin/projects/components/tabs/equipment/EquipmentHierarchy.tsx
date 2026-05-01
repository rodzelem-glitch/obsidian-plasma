import React, { useState } from 'react';
import { Customer, ServiceLocation, EquipmentAsset } from 'types';
import { db } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, MapPin, Box, Link as LinkIcon, Building2, Map } from 'lucide-react';
import Button from 'components/ui/Button';
import Modal from 'components/ui/Modal';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import showToast from 'lib/toast';

import { EQUIPMENT_OPTIONS, LOCATION_OPTIONS } from '@/constants/industryNaming';

interface Props {
    customer: Customer;
}

const EquipmentHierarchy: React.FC<Props> = ({ customer }) => {
    const { state, dispatch } = useAppContext();
    const industry = state.currentOrganization?.industry || 'HVAC';
    const equipmentOptions = EQUIPMENT_OPTIONS[industry] || EQUIPMENT_OPTIONS['default'];
    const locationOptions = LOCATION_OPTIONS[industry] || LOCATION_OPTIONS['default'];
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Partial<ServiceLocation> | null>(null);

    const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
    const [editingEquipment, setEditingEquipment] = useState<Partial<EquipmentAsset> | null>(null);

    const locations = customer.serviceLocations || [];
    const equipment = customer.equipment || [];

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedNodes(newExpanded);
    };

    const handleSaveLocation = async () => {
        if (!editingLocation?.name) {
            showToast.error("Name is required");
            return;
        }

        let updatedLocations = [...locations];
        if (editingLocation.id) {
            updatedLocations = updatedLocations.map(l => l.id === editingLocation.id ? editingLocation as ServiceLocation : l);
        } else {
            const newLoc: ServiceLocation = {
                ...editingLocation,
                id: `loc-${Date.now()}`,
                address: editingLocation.address || customer.address || '',
            } as ServiceLocation;
            updatedLocations.push(newLoc);
        }

        try {
            await db.collection('customers').doc(customer.id).update({ serviceLocations: updatedLocations });
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: updatedLocations } });
            setIsLocationModalOpen(false);
            showToast.success("Location saved");
        } catch (error) {
            console.error(error);
            showToast.error("Failed to save location");
        }
    };

    const handleDeleteLocation = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this location? Equipment in this location will become unassigned.")) return;
        
        const updatedLocations = locations.filter(l => l.id !== id);
        // Also remove parentId for children
        const finalLocations = updatedLocations.map(l => l.parentId === id ? { ...l, parentId: null } : l);
        
        // Remove propertyId for equipment
        const updatedEquipment = equipment.map(e => e.propertyId === id ? { ...e, propertyId: undefined } : e);

        try {
            await db.collection('customers').doc(customer.id).update({ 
                serviceLocations: finalLocations,
                equipment: updatedEquipment
            });
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: finalLocations, equipment: updatedEquipment } });
            showToast.success("Location deleted");
        } catch (error) {
            console.error(error);
            showToast.error("Failed to delete location");
        }
    };

    const handleSaveEquipment = async () => {
        if (!editingEquipment?.brand || !editingEquipment?.model) {
            showToast.error("Brand and Model are required");
            return;
        }

        let updatedEquipment = [...equipment];
        if (editingEquipment.id) {
            updatedEquipment = updatedEquipment.map(e => e.id === editingEquipment.id ? editingEquipment as EquipmentAsset : e);
        } else {
            const newEq: EquipmentAsset = {
                ...editingEquipment,
                id: `eq-${Date.now()}`,
                type: editingEquipment.type || 'System',
                serial: editingEquipment.serial || ''
            } as EquipmentAsset;
            updatedEquipment.push(newEq);
        }

        try {
            await db.collection('customers').doc(customer.id).update({ equipment: updatedEquipment });
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: updatedEquipment } });
            setIsEquipmentModalOpen(false);
            showToast.success("Equipment saved");
        } catch (error) {
            console.error(error);
            showToast.error("Failed to save equipment");
        }
    };

    const handleDeleteEquipment = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this equipment?")) return;
        const updatedEquipment = equipment.filter(e => e.id !== id);
        try {
            await db.collection('customers').doc(customer.id).update({ equipment: updatedEquipment });
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: updatedEquipment } });
            showToast.success("Equipment deleted");
        } catch (error) {
            console.error(error);
            showToast.error("Failed to delete equipment");
        }
    };

    const openLocationModal = (parentId?: string, loc?: Partial<ServiceLocation>) => {
        setEditingLocation(loc || { parentId: parentId || null, locationType: 'Building', name: '' });
        setIsLocationModalOpen(true);
    };

    const openEquipmentModal = (propertyId?: string, eq?: Partial<EquipmentAsset>) => {
        setEditingEquipment(eq || { propertyId: propertyId || '', brand: '', model: '', serial: '', type: 'System' });
        setIsEquipmentModalOpen(true);
    };

    const renderEquipmentNode = (eq: EquipmentAsset, depth: number) => {
        return (
            <div key={eq.id} className="hierarchy-depth-node flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0" data-depth={depth}>
                <div className="flex items-center gap-3">
                    <Box size={16} className="text-blue-500 shrink-0" />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{eq.name || `${eq.brand} ${eq.model}`}</span>
                            <span className={`text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full font-medium`}>{eq.type}</span>
                            {eq.condition && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${eq.condition === 'Excellent' || eq.condition === 'Good' ? 'bg-green-100 text-green-700' : eq.condition === 'Fair' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{eq.condition}</span>}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            SN: {eq.serial || 'N/A'} {eq.location ? ` • ${eq.location}` : ''}
                        </div>
                        {eq.linkedAssetIds && eq.linkedAssetIds.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-500">
                                <LinkIcon size={10} /> Linked to {eq.linkedAssetIds.length} item(s)
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 transition-opacity">
                    <button onClick={() => openEquipmentModal(eq.propertyId, eq)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors" title="Edit">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteEquipment(eq.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-slate-700 transition-colors" title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        );
    };

    const renderLocationNode = (loc: ServiceLocation, depth: number = 0) => {
        const isExpanded = expandedNodes.has(loc.id);
        const childLocations = locations.filter(l => l.parentId === loc.id);
        const childEquipment = equipment.filter(e => e.propertyId === loc.id);
        const hasChildren = childLocations.length > 0 || childEquipment.length > 0;

        return (
            <div key={loc.id} className="border-b border-slate-200 dark:border-slate-700 last:border-0">
                <div className="hierarchy-depth-node flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group" data-depth={depth}>
                    <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => toggleExpand(loc.id)}>
                        <div className="w-5 flex justify-center text-slate-400">
                            {hasChildren ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <div className="w-4 h-4" />}
                        </div>
                        {loc.locationType === 'Campus' || loc.locationType === 'Property' ? <Map size={16} className="text-emerald-600 shrink-0" /> : <Building2 size={16} className="text-indigo-500 shrink-0" />}
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{loc.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700 font-medium uppercase tracking-wider">{loc.locationType || 'Location'}</span>
                            </div>
                            {loc.address && <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><MapPin size={10}/> {loc.address}</div>}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openLocationModal(loc.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors text-xs flex items-center gap-1 font-medium" title="Add Sub-Location">
                            <Plus size={12} /> <MapPin size={12}/>
                        </button>
                        <button onClick={() => openEquipmentModal(loc.id)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-xs flex items-center gap-1 font-medium border-r border-slate-200 dark:border-slate-700 pr-2 mr-1" title="Add Equipment">
                            <Plus size={12} /> <Box size={12}/>
                        </button>
                        <button onClick={() => openLocationModal(loc.parentId || undefined, loc)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors" title="Edit">
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteLocation(loc.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-slate-700 transition-colors" title="Delete">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {isExpanded && hasChildren && (
                    <div className="bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800/50">
                        {childLocations.map(child => renderLocationNode(child, depth + 1))}
                        {childEquipment.map(eq => renderEquipmentNode(eq, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    const rootLocations = locations.filter(l => !l.parentId);
    const unassignedEquipment = equipment.filter(e => !e.propertyId);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <MapPin className="text-emerald-500" size={18} /> Asset Hierarchy
                </h4>
                <div className="flex items-center gap-2">
                    <Button onClick={() => openLocationModal()} variant="outline" size="sm" className="flex items-center gap-1"><Plus size={14}/> Add Location</Button>
                    <Button onClick={() => openEquipmentModal()} variant="outline" size="sm" className="flex items-center gap-1"><Plus size={14}/> Add Equipment</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                {rootLocations.length === 0 && unassignedEquipment.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <Box size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="font-medium">No locations or equipment configured.</p>
                        <p className="text-sm mt-1">Add a location or equipment item to start building your hierarchy.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {rootLocations.map(loc => renderLocationNode(loc, 0))}
                        
                        {unassignedEquipment.length > 0 && (
                            <div className="border-t-4 border-slate-100 dark:border-slate-800">
                                <div className="py-2 px-3 bg-slate-50 dark:bg-slate-800/80">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unassigned Equipment ({unassignedEquipment.length})</span>
                                </div>
                                <div>
                                    {unassignedEquipment.map(eq => renderEquipmentNode(eq, 0))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Location Modal */}
            <Modal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} title={editingLocation?.id ? "Edit Location" : "Add Location"} size="md">
                <div className="space-y-4">
                    <Select label="Location Type" value={editingLocation?.locationType || locationOptions[0]} onChange={e => setEditingLocation({...editingLocation, locationType: e.target.value as any})}>
                        {locationOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </Select>
                    <Input label="Name" value={editingLocation?.name || ''} onChange={e => setEditingLocation({...editingLocation, name: e.target.value})} placeholder="e.g. Main Campus, Building A" />
                    <Select label="Parent Location" value={editingLocation?.parentId || ''} onChange={e => setEditingLocation({...editingLocation, parentId: e.target.value || null})}>
                        <option value="">-- None (Root Level) --</option>
                        {locations.filter(l => l.id !== editingLocation?.id).map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.locationType || 'Location'})</option>
                        ))}
                    </Select>
                    <Input label="Address (Optional)" value={editingLocation?.address || ''} onChange={e => setEditingLocation({...editingLocation, address: e.target.value})} placeholder="Location specific address" />
                    <Input label="Notes" value={editingLocation?.notes || ''} onChange={e => setEditingLocation({...editingLocation, notes: e.target.value})} placeholder="Access details, etc." />
                    
                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSaveLocation} variant="primary" className="w-full">Save Location</Button>
                    </div>
                </div>
            </Modal>

            {/* Equipment Modal */}
            <Modal isOpen={isEquipmentModalOpen} onClose={() => setIsEquipmentModalOpen(false)} title={editingEquipment?.id ? "Edit Equipment" : "Add Equipment"} size="md">
                <div className="space-y-4">
                    <Select label="Parent Location" value={editingEquipment?.propertyId || ''} onChange={e => setEditingEquipment({...editingEquipment, propertyId: e.target.value})}>
                        <option value="">-- Unassigned --</option>
                        {locations.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.locationType || 'Location'})</option>
                        ))}
                    </Select>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Asset Name" value={editingEquipment?.name || ''} onChange={e => setEditingEquipment({...editingEquipment, name: e.target.value})} placeholder="e.g. RTU-1" />
                        <Select label="Type" value={editingEquipment?.type || equipmentOptions[0]} onChange={e => setEditingEquipment({...editingEquipment, type: e.target.value})}>
                            {equipmentOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Brand" value={editingEquipment?.brand || ''} onChange={e => setEditingEquipment({...editingEquipment, brand: e.target.value})} placeholder="e.g. Trane" />
                        <Input label="Model" value={editingEquipment?.model || ''} onChange={e => setEditingEquipment({...editingEquipment, model: e.target.value})} placeholder="Model #" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Serial Number" value={editingEquipment?.serial || ''} onChange={e => setEditingEquipment({...editingEquipment, serial: e.target.value})} placeholder="Serial #" />
                        <Select label="Condition" value={editingEquipment?.condition || ''} onChange={e => setEditingEquipment({...editingEquipment, condition: e.target.value as any})}>
                            <option value="">-- Select --</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Poor">Poor</option>
                            <option value="Critical">Critical</option>
                        </Select>
                    </div>

                    <Input label="Specific Sub-Location" value={editingEquipment?.location || ''} onChange={e => setEditingEquipment({...editingEquipment, location: e.target.value})} placeholder="e.g. Roof, Mech Room 2" />

                    <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Link to other Equipment</p>
                        <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50 space-y-1 custom-scrollbar">
                            {equipment.filter(e => e.id !== editingEquipment?.id).length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-2">No other equipment to link</p>
                            ) : (
                                equipment.filter(e => e.id !== editingEquipment?.id).map(opt => (
                                    <label key={opt.id} className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300"
                                            checked={editingEquipment?.linkedAssetIds?.includes(opt.id) || false}
                                            onChange={(e) => {
                                                const currentLinks = editingEquipment?.linkedAssetIds || [];
                                                if (e.target.checked) {
                                                    setEditingEquipment({...editingEquipment, linkedAssetIds: [...currentLinks, opt.id]});
                                                } else {
                                                    setEditingEquipment({...editingEquipment, linkedAssetIds: currentLinks.filter(id => id !== opt.id)});
                                                }
                                            }}
                                        />
                                        <span className="text-xs text-slate-700 dark:text-slate-300">{opt.name || opt.brand} ({opt.model})</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                    
                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSaveEquipment} variant="primary" className="w-full">Save Equipment</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default EquipmentHierarchy;
