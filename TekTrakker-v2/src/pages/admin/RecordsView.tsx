import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import JobHistory from 'pages/admin/JobHistory';
import Inventory from 'pages/admin/Inventory';
import DocumentCreator from 'pages/admin/DocumentCreator';
import FormBuilder from 'pages/admin/FormBuilder';
import FleetManager from 'pages/admin/FleetManager';
import { useAppContext } from 'context/AppContext';
import { 
    Box, 
    Truck, 
    FileText, 
    ClipboardList, 
    History,
    ArrowLeft,
    ChevronRight,
    Wrench,
    MapPin,
    PenTool
} from 'lucide-react';

const RecordsView: React.FC = () => {
    const { state } = useAppContext();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTool, setActiveTool] = useState<'inventory' | 'history' | 'documents' | 'forms' | 'fleet' | null>(null);

    useEffect(() => {
        const tab = searchParams.get('tab');
        const docId = searchParams.get('docId');
        if (tab === 'fleet') setActiveTool('fleet');
        else if (tab === 'inventory') setActiveTool('inventory');
        else if (tab === 'documents' || docId) setActiveTool('documents');
        else if (tab === 'forms') setActiveTool('forms');
        else if (tab === 'history') setActiveTool('history');
        else setActiveTool(null);
    }, [searchParams]);

    const handleSelectTool = (tool: 'inventory' | 'history' | 'documents' | 'forms' | 'fleet') => {
        setActiveTool(tool);
        setSearchParams({ tab: tool });
    };

    const handleBack = () => {
        setActiveTool(null);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('tab');
        newParams.delete('search');
        newParams.delete('docId');
        setSearchParams(newParams);
    };

    if (activeTool) {
        return (
            <div className="space-y-4">
                <button 
                    onClick={handleBack}
                    className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-primary-600 transition-colors bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-fit"
                >
                    <ArrowLeft size={16} /> Back to Records Dashboard
                </button>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2 md:p-4">
                    {activeTool === 'inventory' && <Inventory />}
                    {activeTool === 'fleet' && <FleetManager />}
                    {activeTool === 'documents' && <DocumentCreator />}
                    {activeTool === 'forms' && <FormBuilder />}
                    {activeTool === 'history' && <JobHistory />}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Inventory Card */}
                <div 
                    onClick={() => handleSelectTool('inventory')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer p-6 flex flex-col group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                            <Box size={28} />
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Inventory</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 mb-4">
                        Track material stock, tools, pricing, and required EPA Refrigerant logs.
                    </p>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                            {state.inventory?.length || 0} Items
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded flex items-center gap-1">
                            <Wrench size={10} /> EPA Active
                        </span>
                    </div>
                </div>

                {/* Fleet Card */}
                <div 
                    onClick={() => handleSelectTool('fleet')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer p-6 flex flex-col group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-xl group-hover:scale-110 transition-transform">
                            <Truck size={28} />
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-orange-500 transition-colors" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Fleet Manager</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 mb-4">
                        Manage active vehicles, assign drivers, and monitor maintenance schedules.
                    </p>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                            {state.vehicles?.length || 0} Vehicles
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2 py-1 rounded flex items-center gap-1">
                            <MapPin size={10} /> Active Tracking
                        </span>
                    </div>
                </div>

                {/* Job History Card */}
                <div 
                    onClick={() => handleSelectTool('history')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer p-6 flex flex-col group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                            <History size={28} />
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Job History</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 mb-4">
                        Search and filter all past work orders, invoices, and completion records.
                    </p>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded flex items-center gap-1">
                            Tickets Database
                        </span>
                    </div>
                </div>

                {/* Documents Card */}
                <div 
                    onClick={() => handleSelectTool('documents')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer p-6 flex flex-col group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
                            <FileText size={28} />
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Document Creator</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 mb-4">
                        Generate and request digital signatures for waivers, contracts, and proposals.
                    </p>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded flex items-center gap-1">
                            <PenTool size={10} /> e-Signatures
                        </span>
                    </div>
                </div>

                {/* Forms Builder Card */}
                <div 
                    onClick={() => handleSelectTool('forms')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer p-6 flex flex-col group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400 rounded-xl group-hover:scale-110 transition-transform">
                            <ClipboardList size={28} />
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-pink-500 transition-colors" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Form Builder</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 mb-4">
                        Design required checklists and safety forms for technicians in the field.
                    </p>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                            Drag & Drop
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default RecordsView;

