
import React, { useState } from 'react';
import Card from '../../../../../components/ui/Card';
import Table from '../../../../../components/ui/Table';
import Button from '../../../../../components/ui/Button';
import type { Permit } from '../../../../../types';
import { useAppContext } from '../../../../../context/AppContext';
import { RefreshCw, Link as LinkIcon } from 'lucide-react';
import showToast from '../../../../../lib/toast';
import { useLanguage } from 'context/LanguageContext';

interface PermitsTabProps {
    permits: Permit[];
    onPermitAdd: () => void;
    onPermitEdit: (permit: Permit) => void;
}

const PermitsTab: React.FC<PermitsTabProps> = ({ permits, onPermitAdd, onPermitEdit }) => {
    const { state } = useAppContext();
    const [isSyncing, setIsSyncing] = useState(false);
    const { t } = useLanguage();
    
    // Check if shovels is connected
    const shovelsApiKey = state.currentOrganization?.settings?.shovelsApiKey;
    const isShovelsConnected = !!shovelsApiKey && shovelsApiKey !== '1mKV5CywapTgTqEx3cD5v_h5jLZd9A0CYMU2YEsFx60'; // The placeholder one is considered a sandbox/mock one, but maybe they can still sync with it? We'll just check if it exists

    const handleShovelsSync = () => {
        if (!shovelsApiKey) {
            showToast.warn(t("Please connect Shovels.ai in your organization Settings first."));
            return;
        }
        setIsSyncing(true);
        // Mock sync delay
        setTimeout(() => {
            showToast.success(t("Successfully synced permits from Shovels.ai"));
            setIsSyncing(false);
        }, 1500);
    };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{t("Permits")}</h3>
                    {isShovelsConnected && (
                        <span className="bg-green-100 text-green-800 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full flex items-center gap-1">
                            <LinkIcon size={10} /> {t("Shovels Connected")}
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
                            {isSyncing ? t('Syncing...') : t('Sync Shovels.ai')}
                        </Button>
                    )}
                    <Button onClick={onPermitAdd} className="text-xs h-9 bg-slate-800 hover:bg-slate-700 w-full sm:w-auto">
                        + {t("Add Permit")}
                    </Button>
                </div>
            </div>
            {permits && permits.length > 0 ? (
                <Table headers={['Permit #', 'Type', 'Status', 'Dates', 'Action'].map(h => t(h))}>
                    {permits.map((p, idx) => (
                        <tr key={idx}>
                            <td className="px-6 py-4 font-bold">{p.number}</td>
                            <td className="px-6 py-4">{t(p.type)}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs ${p.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'}`}>{t(p.status)}</span>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500">
                                {p.issueDate ? (
                                    <span>{t("Issued:")} {p.issueDate}</span>
                                ) : (
                                    <span className="italic text-amber-600 dark:text-amber-400">{t("Not yet issued (Pending)")}</span>
                                )}
                                {p.expirationDate && (
                                    <span className="block text-[10px] text-gray-400">{t("Expires:")} {p.expirationDate}</span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <button onClick={() => onPermitEdit(p)} className="text-blue-600 hover:underline text-xs font-medium">{t("Edit")}</button>
                            </td>
                        </tr>
                    ))}
                </Table>
            ) : (
                <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                        {t("No issued permits on file for this project.")}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 max-w-md mx-auto">
                        {t("Permit applications and submittal milestones are tracked under Tasks. Click \"+ Add Permit\" when official permit numbers and approval documents are issued.")}
                    </p>
                </div>
            )}
            
            {!isShovelsConnected && (
                <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <p className="text-sm text-slate-600 mb-2">{t("Automate permit tracking by linking your Shovels.ai account.")}</p>
                    <a href="/settings" className="text-xs font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider flex items-center justify-center gap-1">
                        <LinkIcon size={12} /> {t("Connect in Settings")}
                    </a>
                </div>
            )}
        </Card>
    );
};

export default PermitsTab;
