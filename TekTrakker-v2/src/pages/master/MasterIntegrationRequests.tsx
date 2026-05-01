import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Network, Search, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import showToast from '../../lib/toast';

interface IntegrationRequest {
  id: string;
  orgId: string;
  integrationId: string;
  integrationName: string;
  requestedAt: string;
  status: 'pending' | 'in_progress' | 'completed';
  fieldsProvided: string[];
}

const MasterIntegrationRequests: React.FC = () => {
  const [requests, setRequests] = useState<IntegrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'integration_requests'), orderBy('requestedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IntegrationRequest[];
      
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching integration requests:', error);
      showToast.error('Failed to load integration requests');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: IntegrationRequest['status']) => {
    try {
      await updateDoc(doc(db, 'integration_requests', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      showToast.success(`Status updated to ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      showToast.error('Failed to update status');
    }
  };

  const filteredRequests = requests.filter(req => 
    req.integrationName?.toLowerCase().includes(search.toLowerCase()) ||
    req.orgId?.toLowerCase().includes(search.toLowerCase()) ||
    req.integrationId?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <Network className="text-primary-600" />
          Integration Requests
        </h1>
        <p className="text-slate-500 mt-2">
          Monitor and manage stubbed integration activations requested by organizations.
          {pendingCount > 0 && (
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
              {pendingCount} Pending
            </span>
          )}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by org ID or integration..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Integration</th>
                <th className="px-6 py-4 font-semibold">Organization ID</th>
                <th className="px-6 py-4 font-semibold">Fields Provided</th>
                <th className="px-6 py-4 font-semibold">Requested At</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                      Loading requests...
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Network className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p>No integration requests found.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {request.integrationName || request.integrationId}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {request.integrationId}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                          {request.orgId}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {request.fieldsProvided?.map((field, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                            {field}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {request.requestedAt ? new Date(request.requestedAt).toLocaleString() : 'Unknown'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        request.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                        request.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                      }`}>
                        {request.status === 'completed' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {request.status === 'completed' ? 'Completed' : request.status === 'in_progress' ? 'In Progress' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        aria-label="Update integration status"
                        title="Update integration status"
                        value={request.status || 'pending'}
                        onChange={(e) => handleUpdateStatus(request.id, e.target.value as any)}
                        className="text-xs rounded-md border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MasterIntegrationRequests;
