import { cleanUndefinedFields } from '../../../../lib/utils';
import React, { useState, useEffect } from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Download, Database, UploadCloud, FileUp, Search, Trash2, RefreshCw, Undo, History } from 'lucide-react';
import { db, firebase } from 'lib/firebase';
import { useAppContext } from 'context/AppContext';
import showToast from 'lib/toast';

interface DataTabProps {
    handleExportData: (type: 'customers' | 'jobs' | 'inventory', format: 'csv' | 'json') => void;
    handleDetectDuplicates: () => void;
    handleCleanupRecords: () => void;
    handleFlushCache: () => void;
    handleResetOverlays: () => void;
    handleImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDownloadTemplate: () => void;
}

const DataTab: React.FC<DataTabProps> = ({
    handleExportData,
    handleDetectDuplicates,
    handleCleanupRecords,
    handleFlushCache,
    handleResetOverlays,
    handleImportFile,
    handleDownloadTemplate
}) => {
    const { state } = useAppContext();
    const [deletedRecords, setDeletedRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'All' | 'Job' | 'Proposal'>('All');

    const fetchDeletedRecords = async () => {
        const orgId = state.currentOrganization?.id;
        if (!orgId) return;
        setIsLoading(true);
        try {
            // Fetch deleted jobs
            const jobsSnap = await db.collection('jobs')
                .where('organizationId', '==', orgId)
                .get();
            const deletedJobs = jobsSnap.docs
                .map(doc => ({ ...doc.data(), id: doc.id, recordType: 'Job' }))
                .filter((j: any) => j.deleted);

            // Fetch deleted proposals
            const proposalsSnap = await db.collection('proposals')
                .where('organizationId', '==', orgId)
                .get();
            const deletedProposals = proposalsSnap.docs
                .map(doc => ({ ...doc.data(), id: doc.id, recordType: 'Proposal' }))
                .filter((p: any) => p.deleted);

            const allDeleted = [...deletedJobs, ...deletedProposals].sort((a: any, b: any) => {
                const timeA = new Date(a.deletedAt || 0).getTime();
                const timeB = new Date(b.deletedAt || 0).getTime();
                return timeB - timeA;
            });
            setDeletedRecords(allDeleted);
        } catch (error) {
            console.error("Failed to load deleted records:", error);
            showToast.warn("Failed to load Recycle Bin records.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDeletedRecords();
    }, [state.currentOrganization?.id]);

    const handleRestore = async (record: any) => {
        const confirmRestore = window.confirm(`Are you sure you want to restore this ${record.recordType.toLowerCase()}?`);
        if (!confirmRestore) return;

        try {
            const collectionName = record.recordType === 'Job' ? 'jobs' : 'proposals';
            await db.collection(collectionName).doc(record.id).update(cleanUndefinedFields({
                deleted: false,
                deletedAt: null,
                expireAt: null
            }));
            showToast.success(`${record.recordType} restored successfully!`);
            // Update local state
            setDeletedRecords(prev => prev.filter(r => r.id !== record.id));
        } catch (error) {
            console.error("Failed to restore record:", error);
            showToast.warn("Failed to restore record.");
        }
    };

    const filteredRecords = deletedRecords.filter(r => {
        const matchesType = typeFilter === 'All' || r.recordType === typeFilter;
        const query = searchTerm.toLowerCase();
        const matchesSearch = 
            (r.customerName || '').toLowerCase().includes(query) ||
            (r.id || '').toLowerCase().includes(query) ||
            (r.recordType || '').toLowerCase().includes(query);
        return matchesType && matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="font-bold mb-4 flex items-center gap-2"><Download size={18}/> Data Export</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="text-sm font-medium">Customer List</span>
                            <div className="flex gap-2">
                                <button onClick={() => handleExportData('customers', 'csv')} className="text-xs text-blue-600 font-bold hover:underline">CSV</button>
                                <button onClick={() => handleExportData('customers', 'json')} className="text-xs text-purple-600 font-bold hover:underline">JSON</button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="text-sm font-medium">Job History</span>
                            <div className="flex gap-2">
                                <button onClick={() => handleExportData('jobs', 'csv')} className="text-xs text-blue-600 font-bold hover:underline">CSV</button>
                                <button onClick={() => handleExportData('jobs', 'json')} className="text-xs text-purple-600 font-bold hover:underline">JSON</button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="text-sm font-medium">Inventory</span>
                            <div className="flex gap-2">
                                <button onClick={() => handleExportData('inventory', 'csv')} className="text-xs text-blue-600 font-bold hover:underline">CSV</button>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-bold mb-4 flex items-center gap-2"><Database size={18}/> Data Management</h3>
                    <div className="space-y-3">
                        <Button variant="secondary" onClick={handleDetectDuplicates} className="w-full flex justify-between items-center">
                            <span>Scan for Duplicates</span>
                            <Search size={14}/>
                        </Button>
                        <Button variant="secondary" onClick={handleCleanupRecords} className="w-full flex justify-between items-center text-red-600 border-red-200 bg-red-50 hover:bg-red-100">
                            <span>Purge Archived Records</span>
                            <Trash2 size={14}/>
                        </Button>
                        <Button variant="secondary" onClick={handleResetOverlays} className="w-full flex justify-between items-center text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100">
                            <span>Reset UI Customizations (Unhide Widgets)</span>
                            <RefreshCw size={14}/>
                        </Button>
                        <Button variant="secondary" onClick={handleFlushCache} className="w-full flex justify-between items-center text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100">
                            <span>Force Sync / Clear Cache</span>
                            <RefreshCw size={14}/>
                        </Button>
                    </div>
                </Card>
                
                <Card className="md:col-span-2">
                    <h3 className="font-bold mb-4 flex items-center gap-2"><UploadCloud size={18}/> Bulk Import</h3>
                    <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <FileUp className="mx-auto text-gray-400 mb-2" size={32}/>
                        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Upload Customer CSV</p>
                        <p className="text-xs text-gray-500 mb-4">Drag and drop or click to select</p>
                        <input type="file" accept=".csv" onChange={handleImportFile} className="hidden" id="csv-upload" />
                        <div className="flex justify-center gap-4">
                            <label htmlFor="csv-upload" className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700 transition-colors">
                                Select File
                            </label>
                            <button onClick={handleDownloadTemplate} className="text-xs text-gray-500 hover:text-gray-700 underline">
                                Download Template
                            </button>
                        </div>
                    </div>
                </Card>

                {/* Recycle Bin (Restoration & Compliance) */}
                <Card className="md:col-span-2">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                                <History className="text-primary-500" size={20}/> Recycle Bin (Restoration & Compliance)
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Records here will be permanently auto-purged after 3 years from their deletion date.
                            </p>
                        </div>
                        <Button variant="secondary" onClick={fetchDeletedRecords} disabled={isLoading} className="flex items-center gap-1.5 py-1 px-3 text-xs w-auto">
                            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""}/> Refresh
                        </Button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by customer name or reference ID..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <select
                                aria-label="Filter by Type"
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value as any)}
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                                <option value="All">All Record Types</option>
                                <option value="Job">Jobs / Invoices</option>
                                <option value="Proposal">Proposals</option>
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="py-12 text-center text-xs text-slate-400 italic">
                            Loading Recycle Bin records...
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/10">
                            No soft-deleted records found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Reference ID</th>
                                        <th className="px-4 py-3">Customer</th>
                                        <th className="px-4 py-3">Deleted On</th>
                                        <th className="px-4 py-3">Auto-Purge On</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredRecords.map(record => {
                                        const deleteDate = record.deletedAt ? new Date(record.deletedAt).toLocaleDateString() : 'N/A';
                                        const purgeDate = record.expireAt?.seconds 
                                            ? new Date(record.expireAt.seconds * 1000).toLocaleDateString() 
                                            : record.expireAt instanceof Date 
                                                ? record.expireAt.toLocaleDateString()
                                                : 'N/A';
                                        
                                        return (
                                            <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                        record.recordType === 'Job' 
                                                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                                                            : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                                                    }`}>
                                                        {record.recordType === 'Job' ? 'Job / Invoice' : 'Proposal'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 font-mono font-bold text-slate-400">
                                                    #{record.id.slice(-6).toUpperCase()}
                                                </td>
                                                <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                                                    {record.customerName || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-500">
                                                    {deleteDate}
                                                </td>
                                                <td className="px-4 py-3.5 text-rose-500 font-medium">
                                                    {purgeDate}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <button
                                                        onClick={() => handleRestore(record)}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                                        title="Restore document"
                                                    >
                                                        <Undo size={12}/> Restore
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default DataTab;
