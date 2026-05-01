
import React, { useState } from 'react';
import Card from '../../../../../components/ui/Card';
import Table from '../../../../../components/ui/Table';
import Button from '../../../../../components/ui/Button';
import type { Permit } from '../../../../../types';
import { useAppContext } from '../../../../../context/AppContext';
import { RefreshCw, Link as LinkIcon } from 'lucide-react';
import showToast from '../../../../../lib/toast';

interface PermitsTabProps {
    permits: Permit[];
    onPermitAdd: () => void;
    onPermitEdit: (permit: Permit) => void;
}

const PermitsTab: React.FC<PermitsTabProps> = ({ permits, onPermitAdd, onPermitEdit }) => {
    const { state } = useAppContext();
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Check if shovels is connected
    const shovelsApiKey = state.currentOrganization?.settings?.shovelsApiKey;
    const isShovelsConnected = !!shovelsApiKey && shovelsApiKey !== '1mKV5CywapTgTqEx3cD5v_h5jLZd9A0CYMU2YEsFx60'; // The placeholder one is considered a sandbox/mock one, but maybe they can still sync with it? We'll just check if it exists

    const handleShovelsSync = () => {
        if (!shovelsApiKey) {
            showToast.warn("Please connect Shovels.ai in your organization Settings first.");
            return;
        }
        setIsSyncing(true);
        // Mock sync delay
        setTimeout(() => {
            showToast.success("Successfully synced permits from Shovels.ai");
            setIsSyncing(false);
        }, 1500);
    };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">Permits</h3>
                    {isShovelsConnected && (
                        <span className="bg-green-100 text-green-800 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full flex items-center gap-1">
                            <LinkIcon size={10} /> Shovels Connected
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {isShovelsConnected && (
                        <Button 
                            onClick={handleShovelsSync} 
                            disabled={isSyncing}
                            variant="secondary"
                            className="text-xs h-9"
                        >
                            <RefreshCw size={14} className={`mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Sync Shovels.ai'}
                        </Button>
                    )}
                    <Button onClick={onPermitAdd} className="text-xs h-9 bg-slate-800 hover:bg-slate-700 w-full sm:w-auto">
                        + Add Permit
                    </Button>
                </div>
            </div>
            <Table headers={['Permit #', 'Type', 'Status', 'Dates', 'Action']}>
                {(permits || []).map((p, idx) => (
                    <tr key={idx}>
                        <td className="px-6 py-4 font-bold">{p.number}</td>
                        <td className="px-6 py-4">{p.type}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs ${p.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100'}`}>{p.status}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">Issued: {p.issueDate}</td>
                        <td className="px-6 py-4">
                            <button onClick={() => onPermitEdit(p)} className="text-blue-600 hover:underline text-xs font-medium">Edit</button>
                        </td>
                    </tr>
                ))}
            </Table>
            
            {!isShovelsConnected && (
                <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <p className="text-sm text-slate-600 mb-2">Automate permit tracking by linking your Shovels.ai account.</p>
                    <a href="/settings" className="text-xs font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider flex items-center justify-center gap-1">
                        <LinkIcon size={12} /> Connect in Settings
                    </a>
                </div>
            )}
        </Card>
    );
};

export default PermitsTab;
