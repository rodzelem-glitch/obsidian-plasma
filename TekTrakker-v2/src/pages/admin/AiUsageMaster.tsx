import showToast from "lib/toast";
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { Cpu, Settings, AlertTriangle, Activity, DollarSign, BrainCircuit } from 'lucide-react';
import type { Organization } from '../../types';

interface AiUsageRecord {
  organizationId: string;
  totalTokensUsed: number;
  virtualWorkerTokensUsed?: number;
  virtualWorkerLimitTokens?: number;
  standardLimitTokens?: number;
  lastUpdated: any;
  tasks: Record<string, number>;
  models: Record<string, number>;
}

const AiUsageMaster: React.FC = () => {
  const { state } = useAppContext();
  const [usageRecords, setUsageRecords] = useState<AiUsageRecord[]>([]);
  const [organizations, setOrganizations] = useState<Record<string, Organization>>({});
  const [loading, setLoading] = useState(true);

  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [newStandardLimit, setNewStandardLimit] = useState<string>('');
  const [newVirtualWorkerLimit, setNewVirtualWorkerLimit] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const user = state.currentUser;
    if (!user || (user.role !== 'master_admin' && user.role !== 'franchise_admin')) return;

    let unsubList: (() => void)[] = [];

    // Fetch Orgs for names
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
            const unsub = db.collection('aiUsage').onSnapshot((snapshot) => {
              const records = snapshot.docs.map((doc: any) => ({
                organizationId: doc.id,
                ...doc.data()
              })) as AiUsageRecord[];
              setUsageRecords(records.sort((a, b) => b.totalTokensUsed - a.totalTokensUsed));
              setLoading(false);
            }, (error) => {
              console.error("Error fetching AI Usage:", error);
              setLoading(false);
            });
            unsubList.push(unsub);
        } else {
            // Franchise Admin Check
            if (orgIds.length === 0) {
                setLoading(false);
                return;
            }
            
            const currentRecords = new Map<string, AiUsageRecord>();
            let initialLoadCount = 0;
            
            orgIds.forEach(orgId => {
                const unsub = db.collection('aiUsage').doc(orgId).onSnapshot((doc: any) => {
                    if (doc.exists) {
                        currentRecords.set(orgId, { organizationId: doc.id, ...doc.data() } as AiUsageRecord);
                    } else {
                        currentRecords.delete(orgId);
                    }
                    
                    initialLoadCount++;
                    // Only update state after initial wave fires, or immediately on subsequent fires
                    if (initialLoadCount >= orgIds.length) {
                        const arr = Array.from(currentRecords.values());
                        setUsageRecords([...arr.sort((a, b) => b.totalTokensUsed - a.totalTokensUsed)]);
                        setLoading(false);
                    }
                }, (err) => console.log('Err tracking ai metrics for org', orgId));
                unsubList.push(unsub);
            });
        }
    });

    return () => unsubList.forEach(u => u());
  }, [state.currentUser]);

  const handleOpenLimitModal = (orgId: string, currentStandard?: number, currentVirtualWorker?: number) => {
    setSelectedOrgId(orgId);
    setNewStandardLimit(currentStandard ? currentStandard.toString() : '');
    setNewVirtualWorkerLimit(currentVirtualWorker ? currentVirtualWorker.toString() : '');
    setIsLimitModalOpen(true);
  };

  const handleSaveLimit = async () => {
    if (!selectedOrgId) return;
    setIsSaving(true);
    try {
      const standLimit = parseInt(newStandardLimit.replace(/,/g, ''), 10);
      const vwLimit = parseInt(newVirtualWorkerLimit.replace(/,/g, ''), 10);
      
      await db.collection('aiUsage').doc(selectedOrgId).set({
        standardLimitTokens: isNaN(standLimit) ? null : standLimit,
        virtualWorkerLimitTokens: isNaN(vwLimit) ? null : vwLimit
      }, { merge: true });
      setIsLimitModalOpen(false);
    } catch (e) {
      console.error("Failed to update limit", e);
      showToast.warn("Failed to update limit.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading metrics...</div>;

  const totalPlatformTokens = usageRecords.reduce((sum, r) => sum + (r.totalTokensUsed || 0) + (r.virtualWorkerTokensUsed || 0), 0);
  // Estimate based loosely on 1.5 Pro ($5/1M in, $15/1M out -> roughly $10/1M blended)
  const estimatedCost = (totalPlatformTokens / 1_000_000) * 10;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Total Platform Tokens</span>
            <Activity size={18} className="text-indigo-500" />
          </div>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{totalPlatformTokens.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Combined usage across all orgs</p>
        </Card>
        
        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Estimated Cost</span>
            <DollarSign size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">${estimatedCost.toFixed(2)}</p>
          <p className="text-xs text-slate-500">Based on blended model rates ($10/1M)</p>
        </Card>

        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Active Organizations</span>
            <Cpu size={18} className="text-sky-500" />
          </div>
          <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">{usageRecords.length}</p>
          <p className="text-xs text-slate-500">Currently triggering cloud functions</p>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-bold">
            <h3 className="text-slate-900 dark:text-white">Organization Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
            <Table headers={['Organization', 'Standard Tokens', 'Virtual Worker Tokens', 'Monthly Limit', 'Tasks', 'Actions']}>
            {usageRecords.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No AI usage recorded yet.</td></tr>
            ) : (
                usageRecords.map((record) => {
                const org = organizations[record.organizationId];
                const orgName = org?.name || record.organizationId;
                
                const standLimit = record.standardLimitTokens;
                const vwLimit = record.virtualWorkerLimitTokens;

                const stdTokens = record.totalTokensUsed || 0;
                const vwTokens = record.virtualWorkerTokensUsed || 0;

                const isStdOverLimit = standLimit && stdTokens >= standLimit;
                const percentStdUsed = standLimit ? Math.min(100, (stdTokens / standLimit) * 100) : 0;

                const isVwOverLimit = vwLimit && vwTokens >= vwLimit;
                const percentVwUsed = vwLimit ? Math.min(100, (vwTokens / vwLimit) * 100) : 0;

                return (
                    <tr key={record.organizationId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{orgName}</div>
                        <div className="text-xs text-slate-500 font-mono">{record.organizationId}</div>
                    </td>
                    <td className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{Number(stdTokens).toLocaleString()}</div>
                        <div className="text-xs text-emerald-500 font-mono mb-2">~${((stdTokens / 1_000_000) * 10).toFixed(2)}</div>
                        
                        {standLimit ? (
                            <div className="flex flex-col w-full min-w-[100px]">
                                <div className="flex justify-between text-[10px] mb-1 text-slate-500">
                                    <span>{percentStdUsed.toFixed(0)}%</span>
                                    <span>{standLimit.toLocaleString()} limit</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
                                    <div className={`h-1 rounded-full ${isStdOverLimit ? 'bg-red-500' : 'bg-slate-500'}`} ref={(el) => { if(el) el.style.width = `${percentStdUsed}%`; }}></div>
                                </div>
                                {isStdOverLimit && <div className="text-red-500 text-[10px] mt-1 font-medium">Over Limit</div>}
                            </div>
                        ) : null}
                    </td>
                    <td className="px-6 py-4 bg-indigo-50/30 dark:bg-indigo-900/10 border-x border-indigo-100/50 dark:border-indigo-800/50">
                        <div className="font-medium text-indigo-700 dark:text-indigo-300">{Number(vwTokens).toLocaleString()}</div>
                        <div className="text-xs text-emerald-500 font-mono mb-2">~${((vwTokens / 1_000_000) * 10).toFixed(2)}</div>

                        {vwLimit ? (
                            <div className="flex flex-col w-full min-w-[100px]">
                                <div className="flex justify-between text-[10px] mb-1 text-indigo-400">
                                    <span>{percentVwUsed.toFixed(0)}%</span>
                                    <span>{vwLimit.toLocaleString()} limit</span>
                                </div>
                                <div className="w-full bg-indigo-200/50 dark:bg-indigo-900/50 rounded-full h-1 overflow-hidden">
                                    <div className={`h-1 rounded-full ${isVwOverLimit ? 'bg-red-500' : 'bg-indigo-500'}`} ref={(el) => { if(el) el.style.width = `${percentVwUsed}%`; }}></div>
                                </div>
                                {isVwOverLimit && <div className="text-red-500 text-[10px] mt-1 font-medium">Over Limit</div>}
                            </div>
                        ) : null}
                    </td>
                    <td className="px-6 py-4">
                        <span className="text-slate-400 italic text-sm">Merged to individual columns</span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                            {Object.entries(record.tasks || {}).slice(0, 3).map(([task, count]) => (
                                <div key={task} className="flex justify-between min-w-[140px]">
                                    <span className="truncate pr-2 text-slate-600 dark:text-slate-400">{task}:</span>
                                    <span className="font-mono text-slate-900 dark:text-slate-200">{Number(count).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <Button size="sm" variant="outline" onClick={() => handleOpenLimitModal(record.organizationId, record.standardLimitTokens, record.virtualWorkerLimitTokens)}>
                        <Settings size={14} className="mr-2" /> Adjust Limits
                        </Button>
                    </td>
                    </tr>
                );
                })
            )}
            </Table>
        </div>
      </div>

      <Modal isOpen={isLimitModalOpen} onClose={() => setIsLimitModalOpen(false)} title="Set AI Token Limit">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Set maximum token thresholds for this organization. 
            Virtual Worker limits will actively <strong>hard block</strong> AI agents when reached.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Standard Limit" 
              type="number"
              value={newStandardLimit} 
              onChange={(e) => setNewStandardLimit(e.target.value)} 
              placeholder="No limit"
            />
            <Input 
              label="Virtual Worker Limit" 
              type="number"
              value={newVirtualWorkerLimit} 
              onChange={(e) => setNewVirtualWorkerLimit(e.target.value)} 
              placeholder="No limit"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsLimitModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLimit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Limit'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AiUsageMaster;
