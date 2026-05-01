import React from 'react';
import { Navigation, CheckCircle, User, MapPin, PlusCircle, Sparkles, Camera, ImageIcon, X } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { Job, EquipmentAsset, Customer } from '../../../../types';
import { StoredFile } from '../../../../types/file';
import { formatAddress } from '../../../../lib/utils';

interface ArrivalStepProps {
    job: Job;
    custDetails: { email: string; phone: string; address: string };
    setCustDetails: (details: { email: string; phone: string; address: string }) => void;
    arrivalNotes: string;
    setArrivalNotes: (notes: string) => void;
    assets: EquipmentAsset[];
    isAddAssetOpen: boolean;
    setIsAddAssetOpen: (open: boolean) => void;
    newAsset: any;
    setNewAsset: (asset: any) => void;
    handleAddAsset: () => void;
    isOcrScanning: boolean;
    handleAssetPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>, photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl') => void;
    saveCustomerInfo: () => void;
    customer?: Customer;
    files?: StoredFile[];
    handlePhotoUpload?: (e: React.ChangeEvent<HTMLInputElement>, label: string) => void;
    takeNativePhoto?: () => void;
    onDeletePhoto?: (file: StoredFile) => void;
    onViewPhoto?: (file: StoredFile) => void;
    hidden?: boolean;
}

const ArrivalStep: React.FC<ArrivalStepProps> = ({
    job,
    custDetails,
    setCustDetails,
    arrivalNotes,
    setArrivalNotes,
    assets,
    isAddAssetOpen,
    setIsAddAssetOpen,
    newAsset,
    setNewAsset,
    handleAddAsset,
    isOcrScanning,
    handleAssetPhotoUpload,
    saveCustomerInfo,
    customer,
    files = [],
    handlePhotoUpload,
    takeNativePhoto,
    onDeletePhoto,
    onViewPhoto,
    hidden
}) => {
    if (hidden) return null;
    const arrivalFiles = files.filter(f => (f.metadata?.label || (f as any).label) === 'Pre-Work');
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={() => window.open(`https://maps.google.com/?q=${formatAddress(job.address)}`, '_blank')} className="h-12 bg-blue-600">
                    <Navigation size={18} className="mr-2"/> Navigate
                </Button>
                <Button variant="secondary" className="h-12" onClick={saveCustomerInfo}>
                    <CheckCircle size={18} className="mr-2"/> Confirm Info
                </Button>
            </div>
            <Card>
                <h4 className="font-bold mb-4">Verify Customer Details</h4>
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center gap-3">
                        <User size={18} className="text-slate-500"/>
                        <p className="font-bold text-md text-slate-800 dark:text-slate-100">{job.customerName}</p>
                    </div>
                     <div className="flex items-start gap-3 w-full">
                        <MapPin size={18} className="text-slate-500 mt-2 shrink-0"/>
                        <div className="flex-1 space-y-3">
                            {customer?.serviceLocations && customer.serviceLocations.length > 1 && (
                                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-3 flex items-start gap-2">
                                    <MapPin size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Multiple Properties Detected</p>
                                        <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
                                            This customer has {customer.serviceLocations.length} locations on file. Please explicitly verify the current job appointment address matches your physical arrival location.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {customer?.serviceLocations && customer.serviceLocations.length > 0 && (
                                <Select 
                                    label="Select Service Location (Optional)" 
                                    value={customer.serviceLocations.some(l => l.address === custDetails.address) ? custDetails.address : ''} 
                                    onChange={e => {
                                        if (e.target.value) setCustDetails({...custDetails, address: e.target.value});
                                    }}
                                >
                                    <option value="">-- Manual Entry --</option>
                                    {customer.serviceLocations.map(loc => (
                                        <option key={loc.id} value={loc.address}>{loc.name} - {loc.address}</option>
                                    ))}
                                </Select>
                            )}
                            <Input 
                                id="cust-address" 
                                label="Service Address" 
                                value={custDetails.address || job.address} 
                                onChange={e => setCustDetails({...custDetails, address: e.target.value})} 
                            />
                            <p className="text-xs text-slate-400 mt-1 italic">Updating this adds/edits a property on the customer profile.</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Input 
                        id="cust-phone" 
                        label="Phone" 
                        value={custDetails.phone} 
                        onChange={e => setCustDetails({...custDetails, phone: e.target.value})} 
                    />
                    <Input 
                        id="cust-email" 
                        label="Email" 
                        value={custDetails.email} 
                        onChange={e => setCustDetails({...custDetails, email: e.target.value})} 
                    />
                </div>
            </Card>
            <Card>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">Arrival Notes</h4>
                    <VoiceInput onResult={(text) => setArrivalNotes(arrivalNotes + ' ' + text)} />
                </div>
                <Textarea 
                    rows={3} 
                    placeholder="Site conditions, gate codes, etc..." 
                    value={arrivalNotes} 
                    onChange={e => setArrivalNotes(e.target.value)}
                />
                
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h5 className="font-bold text-sm mb-3">Arrival Photos (Pre-Work)</h5>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                        {takeNativePhoto && (
                            <button onClick={takeNativePhoto} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-primary-300 rounded-xl bg-primary-50 dark:bg-primary-900/10 cursor-pointer hover:bg-primary-100 transition-colors shrink-0 w-24 h-24 shadow-sm">
                                <Camera size={24} className="text-primary-600 mb-2"/>
                                <span className="text-xs font-bold text-primary-700">Camera</span>
                            </button>
                        )}
                        {handlePhotoUpload && (
                            <label htmlFor="arrival-gallery" className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors w-24 h-24 shadow-sm shrink-0">
                                <ImageIcon size={24} className="text-slate-400 mb-2"/>
                                <span className="text-xs font-bold text-slate-500">Gallery</span>
                                <input id="arrival-gallery" type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 'Pre-Work')} className="hidden" />
                            </label>
                        )}
                        {arrivalFiles.map(file => (
                            <div key={file.id} className="relative w-24 h-24 rounded-xl shadow-md shrink-0 border border-slate-200 dark:border-slate-700 group overflow-hidden">
                                <img src={file.dataUrl || (file as any).url} alt="Arrival" className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" onClick={() => onViewPhoto?.(file)} />
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeletePhoto?.(file); }}
                                    aria-label="Delete photo"
                                    title="Delete photo"
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={12}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
            <Card>
                <h4 className="font-bold flex justify-between items-center mb-4">
                    <span>Equipment On Site</span>
                    {!isAddAssetOpen && (
                        <button 
                            onClick={() => {
                                setNewAsset({ brand: '', model: '', serial: '', type: 'System', location: '', condition: '', propertyId: '' });
                                setIsAddAssetOpen(true);
                            }} 
                            className="text-sm text-primary-600 font-bold bg-primary-50 px-3 py-1.5 rounded-md border border-primary-200 hover:bg-primary-100 transition-colors"
                        >
                            + Add Asset
                        </button>
                    )}
                </h4>
                
                {assets.length > 0 ? assets.map(a => (
                    <div key={a.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-3 border border-slate-200 dark:border-slate-700 flex justify-between items-start">
                        <div>
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{a.name ? `${a.name} (${a.brand} ${a.type})` : `${a.brand} ${a.type}`}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">S/N: {a.serial}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Loc: {a.location || 'N/A'}</p>
                        </div>
                        <button onClick={() => {
                            setNewAsset(a);
                            setIsAddAssetOpen(true);
                        }} className="text-primary-600 font-bold text-xs hover:underline">
                            Edit
                        </button>
                    </div>
                )) : (
                    !isAddAssetOpen && <p className="text-sm text-slate-400 italic mb-4">No assets listed.</p>
                )}

                {isAddAssetOpen && (
                    <div className="mt-4 p-4 border border-primary-200 bg-primary-50/30 dark:bg-slate-800 rounded-xl space-y-4">
                        <h5 className="font-bold text-slate-800 dark:text-slate-100">{newAsset.id ? 'Edit Asset' : 'Add New Asset'}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Name (e.g. Roof Unit 1)" value={newAsset.name || ''} onChange={e => setNewAsset({...newAsset, name: e.target.value})} placeholder="Optional: System Name"/>
                            <Select label="Type" value={newAsset.type || 'System'} onChange={e => setNewAsset({...newAsset, type: e.target.value as any})}>
                                <option>System</option>
                                <option>Unit</option>
                                <option>Part</option>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Brand" value={newAsset.brand} onChange={e => setNewAsset({...newAsset, brand: e.target.value})} placeholder="e.g. Trane, Goodman"/>
                            <Input label="Model" value={newAsset.model} onChange={e => setNewAsset({...newAsset, model: e.target.value})} placeholder="e.g. XV20i"/>
                        </div>
                        
                        <div className="flex items-center gap-2 relative">
                            <div className="flex-1">
                                <Input label="Serial Number" value={newAsset.serial} onChange={e => setNewAsset({...newAsset, serial: e.target.value})} placeholder="e.g. 12345ABC"/>
                            </div>
                            {isOcrScanning && <div className="absolute right-3 top-9 text-xs text-primary-500 font-bold animate-pulse flex items-center gap-1"><Sparkles size={12}/> Scanning...</div>}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select label="Property Mapping" value={newAsset.propertyId || ''} onChange={e => setNewAsset({...newAsset, propertyId: e.target.value})}>
                                <option value="">Default Address</option>
                                {customer?.serviceLocations?.map((loc: any) => (
                                    <option key={loc.id} value={loc.id}>{loc.name} - {loc.address}</option>
                                ))}
                            </Select>
                            <Input label="Sub-Location (e.g. Attic)" value={newAsset.location || ''} onChange={e => setNewAsset({...newAsset, location: e.target.value})} placeholder="e.g. Roof, Basement"/>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Install Date" type="date" value={newAsset.installDate || ''} onChange={e => setNewAsset({...newAsset, installDate: e.target.value})} />
                            <Select label="Condition" value={newAsset.condition || ''} onChange={e => setNewAsset({...newAsset, condition: e.target.value as any})}>
                                <option value="">Select Condition</option>
                                <option value="Excellent">Excellent</option>
                                <option value="Good">Good</option>
                                <option value="Fair">Fair</option>
                                <option value="Poor">Poor</option>
                                <option value="Critical">Critical</option>
                            </Select>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <Input label="Notes" value={newAsset.notes || ''} onChange={e => setNewAsset({...newAsset, notes: e.target.value})} placeholder="Additional details..." />
                        </div>
                        
                        <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2 pt-2">
                            <label className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl cursor-pointer bg-white dark:bg-slate-900 text-xs text-center w-32 h-32 relative transition-colors shadow-sm">
                                {newAsset.serialPhotoUrl ? <img src={newAsset.serialPhotoUrl} alt="Serial" className="absolute inset-0 w-full h-full object-cover rounded-xl" /> : <><PlusCircle size={24} className="mb-2 text-primary-500" /><span className="font-medium text-slate-600 dark:text-slate-300">OCR Serial<br/>Photo</span></>}
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'serialPhotoUrl')} />
                            </label>
                            <label className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl cursor-pointer bg-white dark:bg-slate-900 text-xs text-center w-32 h-32 relative transition-colors shadow-sm">
                                {newAsset.unitTagPhotoUrl ? <img src={newAsset.unitTagPhotoUrl} alt="Tag" className="absolute inset-0 w-full h-full object-cover rounded-xl" /> : <><PlusCircle size={24} className="mb-2 text-primary-500" /><span className="font-medium text-slate-600 dark:text-slate-300">OCR Unit<br/>Data Plate</span></>}
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'unitTagPhotoUrl')} />
                            </label>
                            <label className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl cursor-pointer bg-white dark:bg-slate-900 text-xs text-center w-32 h-32 relative transition-colors shadow-sm">
                                {newAsset.conditionPhotoUrl ? <img src={newAsset.conditionPhotoUrl} alt="Condition" className="absolute inset-0 w-full h-full object-cover rounded-xl" /> : <><PlusCircle size={24} className="mb-2 text-primary-500" /><span className="font-medium text-slate-600 dark:text-slate-300">Condition<br/>Photo</span></>}
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'conditionPhotoUrl')} />
                            </label>
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                            <Button variant="secondary" onClick={() => setIsAddAssetOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddAsset} disabled={isOcrScanning}>{isOcrScanning ? 'Scanning...' : 'Save Asset'}</Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ArrivalStep;
