import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAppContext } from '../../context/AppContext';
import { MessageSquare, PhoneCall, DollarSign, TrendingUp, ShieldAlert, BarChart3, Search, Calendar } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

interface SmsUsageRecord {
  id: string;
  organizationId: string;
  billingCycle: string;
  totalSmsSent?: number;
  totalSmsReceived?: number;
  totalVoiceMinutes?: number;
  lastUpdated?: any;
}

const TelephonyAnalytics: React.FC = () => {
  const { state } = useAppContext();
  const { allOrganizations } = state;

  const [usageRecords, setUsageRecords] = useState<SmsUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('All');

  // Rates based on the new SaaS Terms & Conditions
  const SMS_RATE = 0.02; // $0.02 per message
  const VOICE_RATE = 0.03; // $0.03 per minute (100% markup on $0.0130 rounded)
  
  // Cost rates (what we pay Twilio)
  const SMS_COST_RATE = 0.0079;
  const VOICE_COST_RATE = 0.013;

  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'smsUsage'));
        const records: SmsUsageRecord[] = [];
        querySnapshot.forEach((doc) => {
          records.push({ id: doc.id, ...doc.data() } as SmsUsageRecord);
        });
        setUsageRecords(records);
      } catch (error) {
        console.error("Error fetching SMS usage metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, []);

  // Map organization names
  const orgNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allOrganizations.forEach(org => {
      map.set(org.id, org.name || 'Unknown Organization');
    });
    return map;
  }, [allOrganizations]);

  // Extract all unique billing cycles
  const billingCycles = useMemo(() => {
    const cycles = new Set<string>();
    usageRecords.forEach(r => {
      if (r.billingCycle) cycles.add(r.billingCycle);
    });
    return ['All', ...Array.from(cycles).sort().reverse()];
  }, [usageRecords]);

  // Calculate detailed organization table entries
  const orgUsageData = useMemo(() => {
    return usageRecords.map(record => {
      const orgName = orgNameMap.get(record.organizationId) || 'Unknown Organization';
      const sent = record.totalSmsSent || 0;
      const received = record.totalSmsReceived || 0;
      const totalSms = sent + received;
      
      const voiceMinutes = record.totalVoiceMinutes || 0; 
      
      // Revenue (charged to user)
      const smsRevenue = totalSms * SMS_RATE;
      const voiceRevenue = voiceMinutes * VOICE_RATE;
      const totalRevenue = smsRevenue + voiceRevenue;

      // Platform Cost (what we pay Twilio)
      const smsCost = totalSms * SMS_COST_RATE;
      const voiceCost = voiceMinutes * VOICE_COST_RATE;
      const totalCost = smsCost + voiceCost;

      const profit = totalRevenue - totalCost;

      return {
        ...record,
        orgName,
        sent,
        received,
        totalSms,
        voiceMinutes,
        totalRevenue,
        totalCost,
        profit
      };
    });
  }, [usageRecords, orgNameMap]);

  // Filter records based on search and cycle selectors
  const filteredRecords = useMemo(() => {
    return orgUsageData.filter(record => {
      const matchesSearch = record.orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            record.organizationId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCycle = selectedCycle === 'All' || record.billingCycle === selectedCycle;
      return matchesSearch && matchesCycle;
    });
  }, [orgUsageData, searchQuery, selectedCycle]);

  // Totals calculations
  const totals = useMemo(() => {
    let sent = 0;
    let received = 0;
    let voice = 0;
    let revenue = 0;
    let cost = 0;

    filteredRecords.forEach(r => {
      sent += r.sent;
      received += r.received;
      voice += r.voiceMinutes;
      revenue += r.totalRevenue;
      cost += r.totalCost;
    });

    return {
      sent,
      received,
      totalSms: sent + received,
      voice,
      revenue,
      cost,
      profit: revenue - cost
    };
  }, [filteredRecords]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Telephony & Messaging Analytics</h1>
          <p className="text-sm text-slate-500">Track platform-wide SMS/Voice usage metrics, estimated costs, and tenant billing statistics.</p>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Total SMS Sent</h3>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.sent.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">Inbound: {totals.received.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <MessageSquare size={24} />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Voice Usage</h3>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{totals.voice.toLocaleString()} min</p>
            <p className="text-[10px] text-slate-400">Outbound Dispatch Calls</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <PhoneCall size={24} />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Usage Revenue</h3>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">${totals.revenue.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400">SMS: ${totals.totalSms * SMS_RATE} | Voice: ${totals.voice * VOICE_RATE}</p>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <DollarSign size={24} />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Telephony Margin</h3>
            <p className="text-2xl font-black text-slate-900 dark:text-white">${totals.profit.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400">Est. Twilio cost: ${totals.cost.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
            <TrendingUp size={24} />
          </div>
        </Card>
      </div>

      {/* Compliance / Disclaimer Panel */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 rounded-xl flex items-start gap-4">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
          <ShieldAlert size={20} />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-amber-800 dark:text-amber-200 text-sm">Regulatory Compliance (TCPA & A2P 10DLC)</h4>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            All tenant organizations utilizing platform-wide numbers must maintain active customer consent profiles. Under Section 5 of the SaaS Agreement, any messaging campaign resulting in spam complaints or carrier blockages will trigger automatic suspension of the organization's outbound messaging routing.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by organization name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-xl bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium shrink-0">
            <Calendar size={16} /> Billing Cycle:
          </div>
          <select
            value={selectedCycle}
            onChange={(e) => setSelectedCycle(e.target.value)}
            className="px-3 py-2 border rounded-xl bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {billingCycles.map(cycle => (
              <option key={cycle} value={cycle}>{cycle}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Usage Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No telephony usage records found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th className="p-4">Organization</th>
                  <th className="p-4">Billing Cycle</th>
                  <th className="p-4 text-center">SMS Sent</th>
                  <th className="p-4 text-center">SMS Received</th>
                  <th className="p-4 text-center">Voice Minutes</th>
                  <th className="p-4 text-right">Est. Twilio Cost</th>
                  <th className="p-4 text-right">Charged Revenue</th>
                  <th className="p-4 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-700 text-sm text-slate-600 dark:text-slate-300">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      {record.orgName}
                      <span className="block font-mono text-[10px] text-slate-400 mt-0.5">{record.organizationId}</span>
                    </td>
                    <td className="p-4 font-mono">{record.billingCycle}</td>
                    <td className="p-4 text-center">{record.sent.toLocaleString()}</td>
                    <td className="p-4 text-center">{record.received.toLocaleString()}</td>
                    <td className="p-4 text-center">{record.voiceMinutes.toLocaleString()} min</td>
                    <td className="p-4 text-right font-mono">${record.totalCost.toFixed(3)}</td>
                    <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">${record.totalRevenue.toFixed(2)}</td>
                    <td className="p-4 text-right font-mono text-slate-900 dark:text-white font-bold">${record.profit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TelephonyAnalytics;
