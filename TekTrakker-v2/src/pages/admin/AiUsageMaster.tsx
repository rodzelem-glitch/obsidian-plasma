import { cleanUndefinedFields } from '../../lib/utils';
import showToast from "lib/toast";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { Cpu, Settings, AlertTriangle, Activity, DollarSign, BrainCircuit, Calendar } from 'lucide-react';
import type { Organization } from '../../types';

interface MonthlyAiUsage {
  totalTokensUsed?: number;
  promptTokensUsed?: number;
  candidatesTokensUsed?: number;
  virtualWorkerTokensUsed?: number;
  virtualWorkerPromptTokensUsed?: number;
  virtualWorkerCandidatesTokensUsed?: number;
  tasks?: Record<string, number>;
  models?: Record<string, number>;
  lastUpdated?: any;
}

interface AiUsageRecord {
  organizationId: string;
  totalTokensUsed: number;
  promptTokensUsed?: number;
  candidatesTokensUsed?: number;
  virtualWorkerTokensUsed?: number;
  virtualWorkerPromptTokensUsed?: number;
  virtualWorkerCandidatesTokensUsed?: number;
  virtualWorkerLimitTokens?: number;
  standardLimitTokens?: number;
  lastUpdated: any;
  tasks: Record<string, number>;
  models: Record<string, number>;
  monthlyUsage?: Record<string, MonthlyAiUsage>;
}

const getCurrentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (monthKey: string): string => {
  if (monthKey === 'all') return 'All Time';
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return monthKey;
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleString('default', { month: 'long' });
  const currentKey = getCurrentMonthKey();
  if (monthKey === currentKey) {
    return `${monthName} ${year} (Current Month)`;
  }
  return `${monthName} ${year}`;
};

const getRecordMetrics = (record: AiUsageRecord, monthKey: string) => {
  if (monthKey === 'all') {
    return {
      stdTokens: record.totalTokensUsed || 0,
      stdPrompt: record.promptTokensUsed || 0,
      stdCandidates: record.candidatesTokensUsed || 0,
      vwTokens: record.virtualWorkerTokensUsed || 0,
      vwPrompt: record.virtualWorkerPromptTokensUsed || 0,
      vwCandidates: record.virtualWorkerCandidatesTokensUsed || 0,
      tasks: record.tasks || {},
      models: record.models || {},
    };
  }

  if (record.monthlyUsage && record.monthlyUsage[monthKey]) {
    const m = record.monthlyUsage[monthKey];
    return {
      stdTokens: m.totalTokensUsed || 0,
      stdPrompt: m.promptTokensUsed || 0,
      stdCandidates: m.candidatesTokensUsed || 0,
      vwTokens: m.virtualWorkerTokensUsed || 0,
      vwPrompt: m.virtualWorkerPromptTokensUsed || 0,
      vwCandidates: m.virtualWorkerCandidatesTokensUsed || 0,
      tasks: m.tasks || {},
      models: m.models || {},
    };
  }

  // Fallback check if doc lastUpdated matches monthKey
  if (record.lastUpdated) {
    let d: Date | null = null;
    if (record.lastUpdated.toDate && typeof record.lastUpdated.toDate === 'function') {
      d = record.lastUpdated.toDate();
    } else if (record.lastUpdated._seconds) {
      d = new Date(record.lastUpdated._seconds * 1000);
    }
    if (d && !isNaN(d.getTime())) {
      const docMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (docMonth === monthKey) {
        return {
          stdTokens: record.totalTokensUsed || 0,
          stdPrompt: record.promptTokensUsed || 0,
          stdCandidates: record.candidatesTokensUsed || 0,
          vwTokens: record.virtualWorkerTokensUsed || 0,
          vwPrompt: record.virtualWorkerPromptTokensUsed || 0,
          vwCandidates: record.virtualWorkerCandidatesTokensUsed || 0,
          tasks: record.tasks || {},
          models: record.models || {},
        };
      }
    }
  }

  return {
    stdTokens: 0,
    stdPrompt: 0,
    stdCandidates: 0,
    vwTokens: 0,
    vwPrompt: 0,
    vwCandidates: 0,
    tasks: {},
    models: {},
  };
};

const AiUsageMaster: React.FC = () => {
  const { state } = useAppContext();
  const [usageRecords, setUsageRecords] = useState<AiUsageRecord[]>([]);
  const [organizations, setOrganizations] = useState<Record<string, Organization>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());

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

  const monthOptions = useMemo(() => {
    const monthsSet = new Set<string>();
    const currentKey = getCurrentMonthKey();
    monthsSet.add(currentKey);

    // Add baseline past 12 months
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(k);
    }

    // Include any custom months found in records
    usageRecords.forEach(r => {
      if (r.monthlyUsage) {
        Object.keys(r.monthlyUsage).forEach(k => monthsSet.add(k));
      }
      if (r.lastUpdated) {
        let d: Date | null = null;
        if (r.lastUpdated.toDate && typeof r.lastUpdated.toDate === 'function') {
          d = r.lastUpdated.toDate();
        } else if (r.lastUpdated._seconds) {
          d = new Date(r.lastUpdated._seconds * 1000);
        }
        if (d && !isNaN(d.getTime())) {
          monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      }
    });

    const sortedMonths = Array.from(monthsSet).sort().reverse();
    return [
      ...sortedMonths.map(k => ({ value: k, label: formatMonthLabel(k) })),
      { value: 'all', label: 'All Time' }
    ];
  }, [usageRecords]);

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
      
      await db.collection('aiUsage').doc(selectedOrgId).set(cleanUndefinedFields({
        standardLimitTokens: isNaN(standLimit) ? null : standLimit,
        virtualWorkerLimitTokens: isNaN(vwLimit) ? null : vwLimit
      }), { merge: true });
      setIsLimitModalOpen(false);
    } catch (e) {
      console.error("Failed to update limit", e);
      showToast.warn("Failed to update limit.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading metrics...</div>;

  const calculateRecordCost = (total: number, prompt?: number, candidates?: number) => {
    const p = prompt || 0;
    const c = candidates || 0;
    const splitTotal = p + c;
    const legacyTokens = Math.max(0, total - splitTotal);
    return (p / 1_000_000) * 0.075 + (c / 1_000_000) * 0.30 + (legacyTokens / 1_000_000) * 0.15;
  };

  const totalPlatformTokens = usageRecords.reduce((sum, r) => {
    const m = getRecordMetrics(r, selectedMonth);
    return sum + m.stdTokens + m.vwTokens;
  }, 0);

  const estimatedCost = usageRecords.reduce((sum, r) => {
    const m = getRecordMetrics(r, selectedMonth);
    const stdCost = calculateRecordCost(m.stdTokens, m.stdPrompt, m.stdCandidates);
    const vwCost = calculateRecordCost(m.vwTokens, m.vwPrompt, m.vwCandidates);
    return sum + stdCost + vwCost;
  }, 0);

  const activeOrgsCount = usageRecords.filter(r => {
    const m = getRecordMetrics(r, selectedMonth);
    return (m.stdTokens + m.vwTokens) > 0;
  }).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Usage Period</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Filter telemetry metrics, costs, and task breakdowns by month
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="month-select" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Month:
          </label>
          <select
            id="month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block px-3 py-2 font-medium cursor-pointer shadow-sm transition-all"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Total Platform Tokens</span>
            <Activity size={18} className="text-indigo-500" />
          </div>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{totalPlatformTokens.toLocaleString()}</p>
          <p className="text-xs text-slate-500">
            {selectedMonth === 'all' ? 'Combined usage across all orgs (All Time)' : `Combined usage across all orgs (${formatMonthLabel(selectedMonth)})`}
          </p>
        </Card>
        
        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Estimated Cost</span>
            <DollarSign size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">${estimatedCost.toFixed(2)}</p>
          <p className="text-xs text-slate-500">Based on Gemini 3.8 Flash pricing ($0.75/1M input, $3.75/1M output)</p>
        </Card>

        <Card className="flex flex-col gap-2 relative">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Active Organizations</span>
            <Cpu size={18} className="text-sky-500" />
          </div>
          <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">{activeOrgsCount}</p>
          <p className="text-xs text-slate-500">
            {selectedMonth === 'all' ? 'Organizations with active AI usage' : `Orgs active in ${formatMonthLabel(selectedMonth)}`}
          </p>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-bold flex justify-between items-center">
            <h3 className="text-slate-900 dark:text-white">Organization Breakdown</h3>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Showing: <span className="font-medium text-indigo-600 dark:text-indigo-400">{formatMonthLabel(selectedMonth)}</span>
            </span>
        </div>
        <div className="overflow-x-auto">
            <Table headers={['Organization', 'Standard Tokens', 'Virtual Worker Tokens', 'Monthly Limit', 'Tasks', 'Actions']}>
            {usageRecords.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No AI usage recorded yet.</td></tr>
            ) : (
                usageRecords.map((record) => {
                const metrics = getRecordMetrics(record, selectedMonth);
                const org = organizations[record.organizationId];
                const orgName = org?.name || record.organizationId;
                
                const standLimit = record.standardLimitTokens;
                const vwLimit = record.virtualWorkerLimitTokens;

                const stdTokens = metrics.stdTokens;
                const vwTokens = metrics.vwTokens;

                const isStdOverLimit = standLimit && stdTokens >= standLimit;
                const percentStdUsed = standLimit ? Math.min(100, (stdTokens / standLimit) * 100) : 0;

                const isVwOverLimit = vwLimit && vwTokens >= vwLimit;
                const percentVwUsed = vwLimit ? Math.min(100, (vwTokens / vwLimit) * 100) : 0;

                const stdCost = calculateRecordCost(stdTokens, metrics.stdPrompt, metrics.stdCandidates);
                const vwCost = calculateRecordCost(vwTokens, metrics.vwPrompt, metrics.vwCandidates);

                return (
                    <tr key={record.organizationId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{orgName}</div>
                        <div className="text-xs text-slate-500 font-mono">{record.organizationId}</div>
                    </td>
                    <td className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{Number(stdTokens).toLocaleString()}</div>
                        <div className="text-xs text-emerald-500 font-mono mb-2">~${stdCost.toFixed(2)}</div>
                        
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
                        <div className="text-xs text-emerald-500 font-mono mb-2">~${vwCost.toFixed(2)}</div>

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
                        <div className="text-xs space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                            {Object.entries(metrics.tasks || {}).length === 0 ? (
                                <span className="text-slate-400 italic">No tasks recorded</span>
                            ) : (
                                Object.entries(metrics.tasks || {}).map(([task, count]) => (
                                    <div key={task} className="flex justify-between min-w-[160px] gap-2">
                                        <span className="truncate pr-2 text-slate-600 dark:text-slate-400">{task}:</span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{Number(count).toLocaleString()}</span>
                                    </div>
                                ))
                            )}
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
