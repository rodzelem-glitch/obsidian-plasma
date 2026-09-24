import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { Settings, AlertTriangle, Database, HardDrive, DollarSign, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
    const user = state.currentUser;
    if (!user || (user.role !== 'master_admin' && user.role !== 'franchise_admin')) return;

    let unsubList: (() => void)[] = [];

    // Fetch Orgs for names and plans
    const fetchOrgs = async () => {
      let snap;
      if (user.role === 'franchise_admin') {
         snap = await db.collection('organizations').where('franchiseId', '==', user.franchiseId).get();
      } else {
         snap = await db.collection('organizations').get();
      }
      const orgData: Record<string, Organization> = {};
      const orgIds: string[] = [];
      snap.docs.forEach(doc => {
        orgData[doc.id] = { id: doc.id, ...doc.data() } as Organization;
        orgIds.push(doc.id);
      });
      setOrganizations(orgData);
      return orgIds;
    };

    fetchOrgs().then((orgIds) => {
        if (user.role === 'master_admin') {
            const unsub = db.collection('storageUsage').onSnapshot((snapshot) => {
              const records = snapshot.docs.map((doc: any) => ({
                organizationId: doc.id,
                ...doc.data()
              })) as StorageUsageRecord[];
              setUsageRecords(records.sort((a, b) => b.totalBytesUsed - a.totalBytesUsed));
              setLoading(false);
            }, (error) => {
              console.error("Error fetching Storage Usage:", error);
              setLoading(false);
            });
            unsubList.push(unsub);
        } else {
            // Franchise Admin Check
            if (orgIds.length === 0) {
                setLoading(false);
                return;
            }
            
            const currentRecords = new Map<string, StorageUsageRecord>();
            let initialLoadCount = 0;
            
            orgIds.forEach(orgId => {
                const unsub = db.collection('storageUsage').doc(orgId).onSnapshot((doc: any) => {
                    if (doc.exists) {
                        currentRecords.set(orgId, { organizationId: doc.id, ...doc.data() } as StorageUsageRecord);
                    } else {
                        currentRecords.delete(orgId);
                    }
                    
                    initialLoadCount++;
                    if (initialLoadCount >= orgIds.length) {
                        const arr = Array.from(currentRecords.values());
                        setUsageRecords([...arr.sort((a, b) => b.totalBytesUsed - a.totalBytesUsed)]);
                        setLoading(false);
                    }
                }, (err) => console.log('Err tracking storage metrics for org', orgId));
                unsubList.push(unsub);
            });
        }
    });

    return () => unsubList.forEach(u => u());
  }, [state.currentUser]);

  const handleOpenLimitModal = (orgId: string, currentLimitBytes?: number) => {
    setSelectedOrgId(orgId);
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
      
      await db.collection('storageUsage').doc(selectedOrgId).set(cleanUndefinedFields({
        limitBytes: limitBytes
      }), { merge: true });
      setIsLimitModalOpen(false);
    } catch (e) {
      console.error("Failed to update limit", e);
      showToast.warn("Failed to update storage limit.");
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

  const getPlanStorageConfig = (planKey?: string) => {
    const key = (planKey || 'starter').toLowerCase();
    const planConfig = state.platformSettings?.plans?.[key];
    const includedGB = planConfig?.includedStorageGB ?? (key === 'enterprise' ? 100 : key === 'business' ? 25 : key === 'growth' ? 10 : key === 'starter' ? 1 : 0.5);
    const overageRate = planConfig?.storageOverageRatePerGB ?? (key === 'enterprise' ? 0.05 : 0.10);
    return { includedGB, overageRate, planName: key };
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading metrics...</div>;

  const totalPlatformBytes = usageRecords.reduce((sum, r) => sum + (r.totalBytesUsed || 0), 0);
  const totalPlatformGB = totalPlatformBytes / (1024 * 1024 * 1024);
  
  // Platform Infrastructure Cost: Google Cloud Storage baseline of 5GB free platform-wide. Rate: $0.026/GB after.
  const estimatedBillablePlatformGB = Math.max(0, totalPlatformGB - 5);
  const estimatedCloudProviderCost = estimatedBillablePlatformGB * 0.026;

  // Calculate total overage revenue billed across all orgs based on plan quotas
  const totalOverageRevenue = usageRecords.reduce((sum, record) => {
    const org = organizations[record.organizationId];
    const { includedGB, overageRate } = getPlanStorageConfig(org?.plan);
    const usedGB = (record.totalBytesUsed || 0) / (1024 * 1024 * 1024);
    const overageGB = Math.max(0, usedGB - includedGB);
    return sum + (overageGB * overageRate);
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Est. Cloud Provider Cost</span>
            <DollarSign size={18} className="text-rose-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">${estimatedCloudProviderCost.toFixed(2)} <span className="text-xs font-normal text-slate-500">/mo</span></p>
          <p className="text-xs text-slate-500">Includes 5GB free tier baseline ($0.026/GB after)</p>
        </Card>

        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Est. Overage Revenue</span>
            <Database size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">${totalOverageRevenue.toFixed(2)} <span className="text-xs font-normal text-slate-500">/mo</span></p>
          <p className="text-xs text-slate-500">Billed to orgs exceeding tier quotas</p>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-bold flex justify-between items-center">
            <h3 className="text-slate-900 dark:text-white">Organization Breakdown & Storage Quotas</h3>
            <span className="text-xs text-slate-500 font-normal">Active Organizations: {usageRecords.length}</span>
        </div>
        <div className="overflow-x-auto">
            <Table headers={['Organization & Plan', 'Total Volume', 'Plan Storage Quota & Overages', 'Custom Hard Cap Limit', 'Actions']}>
            {usageRecords.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No Storage usage recorded yet.</td></tr>
            ) : (
                usageRecords.map((record) => {
                const org = organizations[record.organizationId];
                const orgName = org?.name || record.organizationId;
                const limitNum = record.limitBytes;
                const isOverLimit = limitNum ? record.totalBytesUsed >= limitNum : false;
                const percentUsed = limitNum ? Math.min(100, (record.totalBytesUsed / limitNum) * 100) : 0;

                const { includedGB, overageRate, planName } = getPlanStorageConfig(org?.plan);
                const usedGB = (record.totalBytesUsed || 0) / (1024 * 1024 * 1024);
                const overageGB = Math.max(0, usedGB - includedGB);
                const overageFee = overageGB * overageRate;

                return (
                    <tr key={record.organizationId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{orgName}</span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
                                {planName}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{record.organizationId}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{formatBytes(record.totalBytesUsed || 0)}</div>
                    </td>
                    <td className="px-6 py-4">
                        {overageFee > 0 ? (
                            <div className="space-y-0.5">
                                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <ShieldAlert size={13} /> Overage: +${overageFee.toFixed(2)}/mo
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {usedGB.toFixed(2)} GB / {includedGB} GB included (+{overageGB.toFixed(2)} GB @ ${overageRate.toFixed(2)}/GB)
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 size={13} /> Within Plan Quota
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {usedGB < 0.01 ? '< 0.01' : usedGB.toFixed(2)} GB used of {includedGB} GB included
                                </div>
                            </div>
                        )}
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
                            {isOverLimit && <div className="text-red-500 text-xs flex mt-1 items-center gap-1 font-medium"><AlertTriangle size={12}/> Over Hard Cap</div>}
                            </div>
                        ) : (
                            <span className="text-slate-400 italic text-xs">No hard cap set</span>
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
            Set a maximum storage volume hard cap threshold (in Gigabytes) for this organization. 
            Currently, limits trigger warnings and prevent further file uploads via storage quota checks.
          </p>
          <Input 
            label="Storage Hard Cap Limit (GBs)" 
            type="number"
            value={newLimitGigabytes} 
            onChange={(e) => setNewLimitGigabytes(e.target.value)} 
            placeholder="No hard cap"
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

