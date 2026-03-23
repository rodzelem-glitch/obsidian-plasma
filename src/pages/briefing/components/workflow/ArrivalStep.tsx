import React from 'react';
import { Navigation, CheckCircle, User, MapPin } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { Job, EquipmentAsset } from '../../../../types';
import { formatAddress } from '../../../../lib/utils';

interface ArrivalStepProps {
    job: Job;
    custDetails: { email: string; phone: string };
    setCustDetails: (details: { email: string; phone: string }) => void;
    arrivalNotes: string;
    setArrivalNotes: (notes: string) => void;
    assets: EquipmentAsset[];
    setIsAddAssetOpen: (open: boolean) => void;
    saveCustomerInfo: () => void;
    hidden?: boolean;
}

const ArrivalStep: React.FC<ArrivalStepProps> = ({
    job,
    custDetails,
    setCustDetails,
    arrivalNotes,
    setArrivalNotes,
    assets,
    setIsAddAssetOpen,
    saveCustomerInfo,
    hidden
}) => {
    if (hidden) return null;
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
                     <div className="flex items-center gap-3">
                        <MapPin size={18} className="text-slate-500"/>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{formatAddress(job.address)}</p>
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
            </Card>
            <Card>
                <h4 className="font-bold mb-4 flex justify-between">
                    <span>Equipment On Site</span>
                    <button 
                        onClick={() => setIsAddAssetOpen(true)} 
                        className="text-xs text-primary-600 font-bold bg-primary-50 px-2 py-1 rounded border border-primary-200"
                    >
                        + Add Asset
                    </button>
                </h4>
                {assets.length > 0 ? assets.map(a => (
                    <div key={a.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded mb-2 border">
                        <p className="font-bold text-sm">{a.brand} {a.type}</p>
                        <p className="text-xs text-slate-500">S/N: {a.serial}</p>
                    </div>
                )) : (
                    <p className="text-sm text-slate-400 italic">No assets listed.</p>
                )}
            </Card>
        </div>
    );
};

export default ArrivalStep;
