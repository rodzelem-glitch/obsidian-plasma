
import React from 'react';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import { Download, Database, UploadCloud, FileUp, Search, Trash2, RefreshCw } from 'lucide-react';

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
            </div>
        </div>
    );
};

export default DataTab;
