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
  limitTokens?: number;
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
  const [newLimit, setNewLimit] = useState<string>('');
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

    // Sub to AI Usage
    const unsubscribe = db.collection('aiUsage').onSnapshot((snapshot) => {
      const records = snapshot.docs.map(doc => ({
        organizationId: doc.id,
        ...doc.data()
      })) as AiUsageRecord[];
      setUsageRecords(records.sort((a, b) => b.totalTokensUsed - a.totalTokensUsed));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching AI Usage:", error);
      setLoading(false);
    });

    fetchOrgs();
    return () => unsubscribe();
  }, [state.currentUser]);

  const handleOpenLimitModal = (orgId: string, currentLimit?: number) => {
    setSelectedOrgId(orgId);
    setNewLimit(currentLimit ? currentLimit.toString() : '');
    setIsLimitModalOpen(true);
  };

  const handleSaveLimit = async () => {
    if (!selectedOrgId) return;
    setIsSaving(true);
    try {
      const limitVal = parseInt(newLimit.replace(/,/g, ''), 10);
      await db.collection('aiUsage').doc(selectedOrgId).set({
        limitTokens: isNaN(limitVal) ? null : limitVal
      }, { merge: true });
      setIsLimitModalOpen(false);
    } catch (e) {
      console.error("Failed to update limit", e);
      alert("Failed to update limit.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading metrics...</div>;

  const totalPlatformTokens = usageRecords.reduce((sum, r) => sum + (r.totalTokensUsed || 0), 0);
  // Estimate based loosely on 1.5 Pro ($5/1M in, $15/1M out -> roughly $10/1M blended)
  const estimatedCost = (totalPlatformTokens / 1_000_000) * 10;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
            <div className="bg-indigo-100 dark:bg-indigo-900 overflow-hidden text-indigo-600 dark:text-indigo-300 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <BrainCircuit size={28} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">AI Token Usage</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Monitor native AI generative costs and limits globally.</p>
            </div>
        </div>
      </header>

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
            <Table headers={['Organization', 'Total Tokens', 'Monthly Limit', 'Tasks', 'Actions']}>
            {usageRecords.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No AI usage recorded yet.</td></tr>
            ) : (
                usageRecords.map((record) => {
                const org = organizations[record.organizationId];
                const orgName = org?.name || record.organizationId;
                const limitNum = record.limitTokens;
                const isOverLimit = limitNum && record.totalTokensUsed >= limitNum;
                const percentUsed = limitNum ? Math.min(100, (record.totalTokensUsed / limitNum) * 100) : 0;

                return (
                    <tr key={record.organizationId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{orgName}</div>
                        <div className="text-xs text-slate-500 font-mono">{record.organizationId}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{Number(record.totalTokensUsed || 0).toLocaleString()}</div>
                        <div className="text-xs text-emerald-500 font-mono">~${((record.totalTokensUsed / 1_000_000) * 10).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                        {limitNum ? (
                            <div className="flex flex-col w-full min-w-[120px]">
                            <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-slate-300">
                                <span>{percentUsed.toFixed(1)}%</span>
                                <span>{limitNum.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-1.5 rounded-full ${isOverLimit ? 'bg-red-500' : 'bg-sky-500'}`} style={{ width: `${percentUsed}%` }}></div>
                            </div>
                            {isOverLimit && <div className="text-red-500 text-xs flex mt-1 items-center gap-1 font-medium"><AlertTriangle size={12}/> Over Limit</div>}
                            </div>
                        ) : (
                            <span className="text-slate-400 italic text-sm">Open</span>
                        )}
                        </div>
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
                        <Button size="sm" variant="outline" onClick={() => handleOpenLimitModal(record.organizationId, record.limitTokens)}>
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

      <Modal isOpen={isLimitModalOpen} onClose={() => setIsLimitModalOpen(false)} title="Set AI Token Limit">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Set a maximum token threshold for this organization. 
            Currently, limits only trigger warnings in the background and do not block usage.
          </p>
          <Input 
            label="Token Limit (e.g. 1000000)" 
            type="number"
            value={newLimit} 
            onChange={(e) => setNewLimit(e.target.value)} 
            placeholder="No limit"
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

export default AiUsageMaster;
