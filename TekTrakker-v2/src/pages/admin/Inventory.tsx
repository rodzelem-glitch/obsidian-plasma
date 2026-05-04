import showToast from "lib/toast";
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from 'context/AppContext';
import { useConfirm } from 'context/ConfirmContext';
import { useSearchParams } from 'react-router-dom';
import Card from 'components/ui/Card';
import Table from 'components/ui/Table';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Select from 'components/ui/Select';
import Modal from 'components/ui/Modal';
import { db } from 'lib/firebase';
import type { InventoryItem } from 'types';
import RefrigerantLog from './RefrigerantLog';
import { BarcodeScannerButton } from 'components/ui/BarcodeScanner';

const Inventory: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { confirm } = useConfirm();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'parts' | 'refrigerant'>('parts');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterLocation, setFilterLocation] = useState('All');
    
    // Check for search param from scanner
    useEffect(() => {
        const query = searchParams.get('search');
        if (query) {
            setSearchTerm(query);
        }
    }, [searchParams]);

    // Transfer State
    const [transferItem, setTransferItem] = useState<InventoryItem | null>(null);
    const [transferDest, setTransferDest] = useState('');
    const [transferQty, setTransferQty] = useState(1);

    // Default Item
    const initialItem: InventoryItem = {
        id: '',
        organizationId: state.currentOrganization?.id || '',
        name: '',
        sku: '',
        barcode: '',
        category: 'Parts',
        quantity: 0,
        minQuantity: 5,
        cost: 0,
        price: 0,
        location: 'Warehouse',
        lastUpdated: new Date().toISOString()
    };
    
    const [editingItem, setEditingItem] = useState<InventoryItem>(initialItem);

    const locations = useMemo(() => {
        const locs = new Set(['Warehouse']);
        state.vehicles.forEach(v => locs.add(`${v.make} ${v.model} (${v.licensePlate})`));
        return Array.from(locs);
    }, [state.vehicles]);

    const [sortBy, setSortBy] = useState('date_desc');

    const filteredInventory = useMemo(() => {
        let items = state.inventory.filter(item => {
            const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (item.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (item.barcode || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesLoc = filterLocation === 'All' || item.location === filterLocation;
            return matchesSearch && matchesLoc;
        });

        items.sort((a, b) => {
            switch (sortBy) {
                case 'name_asc':
                    return (a.name || '').localeCompare(b.name || '');
                case 'sku_asc':
                    return (a.sku || '').localeCompare(b.sku || '');
                case 'qty_asc':
                    return (a.quantity || 0) - (b.quantity || 0);
                case 'qty_desc':
                    return (b.quantity || 0) - (a.quantity || 0);
                case 'date_asc':
                    return new Date(a.lastUpdated || 0).getTime() - new Date(b.lastUpdated || 0).getTime();
                case 'date_desc':
                default:
                    return new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
            }
        });

        return items;
    }, [state.inventory, searchTerm, filterLocation, sortBy]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        try {
            const itemToSave = { 
                ...editingItem, 
                organizationId: editingItem.organizationId || state.currentOrganization?.id || '',
                id: editingItem.id || `inv-${Date.now()}`,
                lastUpdated: new Date().toISOString()
            };

            if (editingItem.id) {
                dispatch({ type: 'UPDATE_INVENTORY', payload: itemToSave });
                await db.collection('inventory').doc(itemToSave.id).update(itemToSave);
            } else {
                dispatch({ type: 'ADD_INVENTORY', payload: itemToSave });
                await db.collection('inventory').doc(itemToSave.id).set(itemToSave);
            }
            setIsModalOpen(false);
            setEditingItem(initialItem);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (item: InventoryItem) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if(await confirm('Delete this item from inventory?')) {
            dispatch({ type: 'DELETE_INVENTORY', payload: id });
            db.collection('inventory').doc(id).delete();
        }
    };

    const handleConvertToCylinder = async (item: InventoryItem) => {
        if (!await confirm(`Convert ${item.name} into an EPA Refrigerant Cylinder? This will move it from standard Parts directly into your EPA Log.`)) return;
        try {
            const cylId = `cyl-${Date.now()}`;
            const cylinder = {
                id: cylId,
                organizationId: state.currentOrganization?.id || item.organizationId,
                cylinderNo: item.barcode || item.sku || 'UNKNOWN',
                type: 'R410A',
                status: 'In Service',
                currentWeight: 0,
                tareWeight: 0,
                updatedAt: new Date().toISOString()
            };
            await db.collection('refrigerantCylinders').doc(cylId).set(cylinder);
            dispatch({ type: 'DELETE_INVENTORY', payload: item.id });
            await db.collection('inventory').doc(item.id).delete();
            setActiveTab('refrigerant');
        } catch (e) {
            console.error(e);
            showToast.warn("Failed to convert item.");
        }
    };
    
    const handleTransferInit = (item: InventoryItem) => {
        setTransferItem(item);
        setTransferDest(locations.find(l => l !== item.location) || locations[0]);
        setTransferQty(1);
        setIsTransferModalOpen(true);
    };

    const handleTransferSubmit = async () => {
        if (!transferItem || !transferDest) return;
        
        if (transferQty > transferItem.quantity) {
            showToast.warn('Insufficient quantity in source location.');
            return;
        }

        // 1. Reduce Source
        const updatedSource = { 
            ...transferItem, 
            quantity: transferItem.quantity - transferQty,
            lastUpdated: new Date().toISOString()
        };
        dispatch({ type: 'UPDATE_INVENTORY', payload: updatedSource });
        await db.collection('inventory').doc(updatedSource.id).update(updatedSource);

        // 2. Increase/Create Destination
        const existingDestItem = state.inventory.find(i => i.sku === transferItem.sku && i.location === transferDest);
        
        if (existingDestItem) {
            const updatedDest = {
                ...existingDestItem,
                quantity: existingDestItem.quantity + transferQty,
                lastUpdated: new Date().toISOString()
            };
            dispatch({ type: 'UPDATE_INVENTORY', payload: updatedDest });
            await db.collection('inventory').doc(updatedDest.id).update(updatedDest);
        } else {
            const newDestItem: InventoryItem = {
                ...transferItem,
                id: `inv-${Date.now()}-transfer`,
                location: transferDest,
                quantity: transferQty,
                lastUpdated: new Date().toISOString(),
                organizationId: state.currentOrganization?.id || transferItem.organizationId
            };
            dispatch({ type: 'ADD_INVENTORY', payload: newDestItem });
            await db.collection('inventory').doc(newDestItem.id).set(newDestItem);
        }

        setIsTransferModalOpen(false);
        setTransferItem(null);
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                
                {activeTab === 'parts' && (
                    <Button onClick={() => { setEditingItem(initialItem); setIsModalOpen(true); }} className="w-auto">
                        Add New Item
                    </Button>
                )}
            </header>

            <div className="flex gap-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
                <button
                    onClick={() => setActiveTab('parts')}
                    className={`px-4 py-2 text-sm font-bold rounded-md uppercase transition-colors shrink-0 ${activeTab === 'parts' ? 'bg-white dark:bg-gray-800 text-primary-600 shadow' : 'text-gray-600 dark:text-gray-300'}`}
                >
                    Parts & Equipment
                </button>
                <button
                    onClick={() => setActiveTab('refrigerant')}
                    className={`px-4 py-2 text-sm font-bold rounded-md uppercase transition-colors shrink-0 ${activeTab === 'refrigerant' ? 'bg-white dark:bg-gray-800 text-primary-600 shadow' : 'text-gray-600 dark:text-gray-300'}`}
                >
                    EPA Refrigerant Log
                </button>
            </div>

            {activeTab === 'refrigerant' ? (
                <RefrigerantLog />
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="flex-1 flex gap-2">
                            <div className="flex-1">
                                <Input label="" placeholder="Search Parts, SKU, or Barcode..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <BarcodeScannerButton onScan={(text) => setSearchTerm(text)} />
                        </div>
                        <div className="flex gap-4">
                            <div className="w-48">
                                <Select label="" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
                                    <option value="All">All Locations</option>
                                    {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                </Select>
                            </div>
                            <div className="w-48">
                                <Select label="" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                    <option value="date_desc">Newest First</option>
                                    <option value="date_asc">Oldest First</option>
                                    <option value="name_asc">Name (A-Z)</option>
                                    <option value="sku_asc">SKU (A-Z)</option>
                                    <option value="qty_asc">Qty (Low-High)</option>
                                    <option value="qty_desc">Qty (High-Low)</option>
                                </Select>
                            </div>
                        </div>
                    </div>

            <Card>
                <Table headers={['Item Name', 'SKU', 'Location', 'Qty', 'Cost', 'Retail', 'Action']}>
                    {filteredInventory.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-6 py-4">
                                <div className="text-gray-900 dark:text-white font-medium">{item.name}</div>
                                <div className="text-xs text-gray-500">{item.category}</div>
                            </td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm font-mono">
                                {item.sku}
                                {item.barcode && <div className="text-[10px] text-gray-400">BC: {item.barcode}</div>}
                            </td>
                            <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">{item.location}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${item.quantity <= item.minQuantity ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/50' : 'bg-green-500/20 text-green-600 dark:text-green-400'}`}>
                                    {item.quantity} {item.quantity <= item.minQuantity && 'Low Stock'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">${item.cost.toFixed(2)}</td>
                            <td className="px-6 py-4 text-gray-900 dark:text-white font-bold">${item.price.toFixed(2)}</td>
                            <td className="px-6 py-4 flex flex-wrap gap-2">
                                <button onClick={() => handleConvertToCylinder(item)} className="text-emerald-500 hover:text-emerald-600 hover:underline text-sm font-bold whitespace-nowrap">Make Cylinder</button>
                                <button onClick={() => handleTransferInit(item)} className="text-blue-500 hover:underline text-sm">Transfer</button>
                                <button onClick={() => handleEdit(item)} className="text-primary-600 hover:underline text-sm">Edit</button>
                                <button onClick={() => handleDelete(item.id)} className="text-red-700 dark:text-red-400 hover:underline text-sm font-bold">Delete</button>
                            </td>
                        </tr>
                    ))}
                    {filteredInventory.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-8 text-center">
                                <p className="text-gray-500 dark:text-gray-400 mb-4">No inventory items found matching "{searchTerm}".</p>
                                {searchTerm && (
                                    <Button 
                                        disabled={isSaving}
                                        onClick={async () => {
                                            const newItem = {
                                                ...initialItem,
                                                barcode: searchTerm,
                                                sku: searchTerm
                                            };
                                            
                                            // If it looks like a barcode (mostly digits), try external lookup
                                            if (/^\d{8,14}$/.test(searchTerm)) {
                                                setIsSaving(true);
                                                try {
                                                    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${searchTerm}`);
                                                    if (res.ok) {
                                                        const data = await res.json();
                                                        if (data.items && data.items.length > 0) {
                                                            const match = data.items[0];
                                                            newItem.name = match.title || `${match.brand || ''} ${match.model || ''}`.trim();
                                                            // Optional: prefill description/category if needed
                                                            showToast.warn(`Found product match: ${newItem.name}`);
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error("Lookup failed", e);
                                                } finally {
                                                    setIsSaving(false);
                                                }
                                            }
                                            
                                            setEditingItem(newItem);
                                            setIsModalOpen(true);
                                        }}
                                    >
                                        {isSaving ? 'Looking up product data...' : `+ Add "${searchTerm}" to Inventory`}
                                    </Button>
                                )}
                            </td>
                        </tr>
                    )}
                </Table>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem.id ? "Edit Item" : "Add Inventory Item"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Item Name" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} required />
                        <Input label="SKU / Part #" value={editingItem.sku} onChange={e => setEditingItem({...editingItem, sku: e.target.value})} required />
                    </div>
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Input label="Barcode / Tag ID" value={editingItem.barcode || ''} onChange={e => setEditingItem({...editingItem, barcode: e.target.value})} placeholder="Scan or enter ID..." />
                        </div>
                        <BarcodeScannerButton onScan={(text) => setEditingItem({...editingItem, barcode: text})} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Category" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value as any})}>
                            <option value="Parts">Parts</option>
                            <option value="Equipment">Equipment</option>
                            <option value="Tools">Tools</option>
                            <option value="Consumables">Consumables</option>
                        </Select>
                        <Select label="Location" value={editingItem.location} onChange={e => setEditingItem({...editingItem, location: e.target.value})}>
                            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Quantity" type="number" value={editingItem.quantity} onChange={e => setEditingItem({...editingItem, quantity: parseInt(e.target.value) || 0})} required />
                        <Input label="Min Alert Qty" type="number" value={editingItem.minQuantity} onChange={e => setEditingItem({...editingItem, minQuantity: parseInt(e.target.value) || 0})} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Unit Cost ($)" type="number" step="0.01" value={editingItem.cost} onChange={e => setEditingItem({...editingItem, cost: parseFloat(e.target.value) || 0})} required />
                        <Input label="Retail Price ($)" type="number" step="0.01" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value) || 0})} required />
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Inventory'}</Button>
                    </div>
                </form>
            </Modal>
            
            <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="Transfer Stock">
                {transferItem && (
                    <div className="space-y-4">
                        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Transferring:</p>
                            <p className="font-bold text-gray-900 dark:text-white text-lg">{transferItem.name} ({transferItem.sku})</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">From: <span className="text-gray-900 dark:text-white">{transferItem.location}</span> (Avail: {transferItem.quantity})</p>
                        </div>
                        <Select label="Destination" value={transferDest} onChange={e => setTransferDest(e.target.value)}>
                            {locations.filter(l => l !== transferItem.location).map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                            ))}
                        </Select>
                        <Input 
                            label="Quantity to Transfer" 
                            type="number" 
                            min="1" 
                            max={transferItem.quantity} 
                            value={transferQty} 
                            onChange={e => setTransferQty(parseInt(e.target.value) || 1)} 
                        />
                        <div className="flex justify-end gap-4 pt-4">
                            <Button variant="secondary" onClick={() => setIsTransferModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleTransferSubmit}>Confirm Transfer</Button>
                        </div>
                    </div>
                )}
            </Modal>
                </div>
            )}
        </div>
    );
};

export default Inventory;
