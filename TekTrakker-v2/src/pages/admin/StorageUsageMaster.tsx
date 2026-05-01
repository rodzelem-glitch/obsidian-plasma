import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { Settings, AlertTriangle, Database, HardDrive, DollarSign } from 'lucide-react';
import type { Organization } from '../../types';

interface StorageUsageRecord {
  organizationId: string;
  totalBytesUsed: number;
  limitBytes?: number;
  lastUpdated: any;
}

const StorageUsageMaster: React.FC = () => {
  const { state } = useAppContext();
  const [usageRecords, setUsageRecords] = useState<StorageUsageRecord[]>([]);
  const [organizations, setOrganizations] = useState<Record<string, Organization>>({});
  const [loading, setLoading] = useState(true);

  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [newLimitGigabytes, setNewLimitGigabytes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!state.currentUser || state.currentUser.role !== 'master_admin') return;

    // Fetch Orgs for names
    const fetchOrgs = async () => {
      const snap = await db.collection('organizations').get();
      const orgData: Record<string, Organization> = {};
      snap.docs.forEach(doc => {
        orgData[doc.id] = { id: doc.id, ...doc.data() } as Organization;
      });
      setOrganizations(orgData);
    };

    // Sub to Storage Usage
    const unsubscribe = db.collection('storageUsage').onSnapshot((snapshot) => {
      const records = snapshot.docs.map(doc => ({
        organizationId: doc.id,
        ...doc.data()
      })) as StorageUsageRecord[];
      setUsageRecords(records.sort((a, b) => b.totalBytesUsed - a.totalBytesUsed));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching Storage Usage:", error);
      setLoading(false);
    });

    fetchOrgs();
    return () => unsubscribe();
  }, [state.currentUser]);

  const handleOpenLimitModal = (orgId: string, currentLimitBytes?: number) => {
    setSelectedOrgId(orgId);
    // Convert current bytes back to gigabytes for the input modal
    const gb = currentLimitBytes ? (currentLimitBytes / (1024 * 1024 * 1024)).toFixed(2) : '';
    setNewLimitGigabytes(gb);
    setIsLimitModalOpen(true);
  };

  const handleSaveLimit = async () => {
    if (!selectedOrgId) return;
    setIsSaving(true);
    try {
      const limitGb = parseFloat(newLimitGigabytes);
      const limitBytes = isNaN(limitGb) ? null : Math.round(limitGb * 1024 * 1024 * 1024);
      
      await db.collection('storageUsage').doc(selectedOrgId).set({
        limitBytes: limitBytes
      }, { merge: true });
      setIsLimitModalOpen(false);
    } catch (e) {
      console.error("Failed to update limit", e);
      alert("Failed to update storage limit.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading metrics...</div>;

  const totalPlatformBytes = usageRecords.reduce((sum, r) => sum + (r.totalBytesUsed || 0), 0);
  const totalPlatformGB = totalPlatformBytes / (1024 * 1024 * 1024);
  
  // First 5GB free. Rate is $0.026 per GB over limit.
  const estimatedBillableGB = Math.max(0, totalPlatformGB - 5);
  const estimatedCost = estimatedBillableGB * 0.026;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
            <div className="bg-amber-100 dark:bg-amber-900/50 overflow-hidden text-amber-600 dark:text-amber-400 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <Database size={28} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cloud Storage Usage</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Monitor native file storage volumes and limits globally.</p>
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Total Platform Storage</span>
            <HardDrive size={18} className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{formatBytes(totalPlatformBytes)}</p>
          <p className="text-xs text-slate-500">Combined volume across all orgs</p>
        </Card>
        
        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Estimated Cost</span>
            <DollarSign size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">${estimatedCost.toFixed(2)}</p>
          <p className="text-xs text-slate-500">Includes 5GB free tier baseline</p>
        </Card>

        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Active Organizations</span>
            <Database size={18} className="text-sky-500" />
          </div>
          <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">{usageRecords.length}</p>
          <p className="text-xs text-slate-500">Orgs streaming storage data</p>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-bold">
            <h3 className="text-slate-900 dark:text-white">Organization Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
            <Table headers={['Organization', 'Total Volume', 'Storage Limit', 'Actions']}>
            {usageRecords.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">No Storage usage recorded yet.</td></tr>
            ) : (
                usageRecords.map((record) => {
                const org = organizations[record.organizationId];
                const orgName = org?.name || record.organizationId;
                const limitNum = record.limitBytes;
                const isOverLimit = limitNum && record.totalBytesUsed >= limitNum;
                const percentUsed = limitNum ? Math.min(100, (record.totalBytesUsed / limitNum) * 100) : 0;

                return (
                    <tr key={record.organizationId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{orgName}</div>
                        <div className="text-xs text-slate-500 font-mono">{record.organizationId}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{formatBytes(record.totalBytesUsed || 0)}</div>
                        <div className="text-xs text-emerald-500 font-mono">
                            {record.totalBytesUsed > (5 * 1024 * 1024 * 1024) 
                              ? `~$${(((record.totalBytesUsed - (5 * 1024 * 1024 * 1024)) / (1024 * 1024 * 1024)) * 0.026).toFixed(2)}`
                              : 'Free Tier'}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                        {limitNum ? (
                            <div className="flex flex-col w-full min-w-[120px]">
                            <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-300">
                                <span>{percentUsed.toFixed(1)}%</span>
                                <span>{formatBytes(limitNum)}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                <style>{`.org-width-${record.organizationId} { width: ${percentUsed}%; }`}</style>
                                <div className={`h-1.5 rounded-full org-width-${record.organizationId} ${isOverLimit ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                            </div>
                            {isOverLimit && <div className="text-red-500 text-xs flex mt-1 items-center gap-1 font-medium"><AlertTriangle size={12}/> Over Limit</div>}
                            </div>
                        ) : (
                            <span className="text-slate-400 italic text-sm">Open</span>
                        )}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <Button size="sm" variant="outline" onClick={() => handleOpenLimitModal(record.organizationId, record.limitBytes)}>
                        <Settings size={14} className="mr-2" /> Adjust Limit
                        </Button>
                    </td>
                    </tr>
                );
                })
            )}
            </Table>
        </div>
      </div>

      <Modal isOpen={isLimitModalOpen} onClose={() => setIsLimitModalOpen(false)} title="Set Storage Limit">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Set a maximum storage volume threshold (in Gigabytes) for this organization. 
            Currently, limits only trigger warnings in the background and do not block usage.
          </p>
          <Input 
            label="Storage Limit (GBs)" 
            type="number"
            value={newLimitGigabytes} 
            onChange={(e) => setNewLimitGigabytes(e.target.value)} 
            placeholder="No limit"
            step="0.1"
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsLimitModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLimit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Limit'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StorageUsageMaster;
