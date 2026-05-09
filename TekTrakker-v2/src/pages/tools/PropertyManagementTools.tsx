import showToast from "lib/toast";
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { db } from '../../lib/firebase';
import { 
    Building, Calculator, CheckSquare, Save, Users 
} from 'lucide-react';
import { ToolReading } from '../../types';
import { formatAddress } from '../../lib/utils';

const PropertyManagementTools: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'make-ready' | 'roi' | 'vendors'>('make-ready');

    // --- MAKE-READY ESTIMATOR ---
    const [unitSqft, setUnitSqft] = useState('');
    const [paintNeeded, setPaintNeeded] = useState(false);
    const [carpetNeeded, setCarpetNeeded] = useState(false);
    const [deepCleanNeeded, setDeepCleanNeeded] = useState(true);

    // --- CAPEX ROI CALCULATOR ---
    const [repairCost, setRepairCost] = useState('');
    const [replacementCost, setReplacementCost] = useState('');
    const [expectedLifeRepair, setExpectedLifeRepair] = useState('');
    const [expectedLifeReplace, setExpectedLifeReplace] = useState('');

    // --- SAVE MODAL ---
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const activeJobs = useMemo(() => 
        state.jobs.filter(j => j.jobStatus !== 'Completed' && j.assignedTechnicianId === state.currentUser?.id),
        [state.jobs, state.currentUser]
    );

    const makeReadyEstimate = useMemo(() => {
        const sqft = parseFloat(unitSqft) || 0;
        let days = 0;
        let cost = 0;

        if (sqft > 0) {
            if (paintNeeded) { days += 2; cost += (sqft * 1.50); }
            if (carpetNeeded) { days += 1; cost += (sqft * 3.00); }
            if (deepCleanNeeded) { days += 1; cost += (sqft * 0.25); }
        }
        return { days, cost };
    }, [unitSqft, paintNeeded, carpetNeeded, deepCleanNeeded]);

    const roiAnalysis = useMemo(() => {
        const rCost = parseFloat(repairCost) || 0;
        const replCost = parseFloat(replacementCost) || 0;
        const rLife = parseFloat(expectedLifeRepair) || 1;
        const replLife = parseFloat(expectedLifeReplace) || 1;

        const repairCostPerYear = rCost / rLife;
        const replaceCostPerYear = replCost / replLife;

        return {
            repairCostPerYear,
            replaceCostPerYear,
            recommendation: replaceCostPerYear < repairCostPerYear ? 'Replace' : 'Repair'
        };
    }, [repairCost, replacementCost, expectedLifeRepair, expectedLifeReplace]);

    const handleSaveToJob = async () => {
        if (!selectedJobId || isSaving) return;
        setIsSaving(true);
        try {
            const reading: ToolReading = {
                id: `read_${Date.now()}`,
                type: 'Property_Management_Log',
                timestamp: new Date().toISOString(),
                data: {
                    makeReady: activeTab === 'make-ready' ? { sqft: unitSqft, estDays: makeReadyEstimate.days, estCost: makeReadyEstimate.cost } : null,
                    roi: activeTab === 'roi' ? { repairCost, replacementCost, recommendation: roiAnalysis.recommendation } : null
                },
                performedBy: state.currentUser?.id || 'pm'
            };
            const job = state.jobs.find(j => j.id === selectedJobId);
            if (job) {
                const updatedReadings = [...(job.toolReadings || []), reading];
                await db.collection('jobs').doc(selectedJobId).update({ toolReadings: updatedReadings });
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, toolReadings: updatedReadings } });
            }
            setIsSaveModalOpen(false);
            showToast.warn("Data saved to property file.");
        } catch (error) {
            showToast.warn("Save failed.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 pb-32 space-y-6 max-w-5xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 {activeJobs.length > 0 && (
                    <Button onClick={() => setIsSaveModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Save size={18} className="mr-2" /> Save to Property Job
                    </Button>
                )}
            </header>

            <div className="flex flex-wrap gap-2 overflow-x-auto custom-scrollbar bg-transparent sticky top-0 z-10 p-1 mb-4">
                {[
                    { id: 'make-ready', label: 'Make-Ready Estimator', icon: CheckSquare },
                    { id: 'roi', label: 'Repair vs. Replace ROI', icon: Calculator },
                    { id: 'vendors', label: 'Vendor Matrix', icon: Users }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'make-ready' | 'roi' | 'vendors')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-xl whitespace-nowrap border-2 ${
                            activeTab === tab.id 
                                ? 'border-indigo-500 text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20' 
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm'
                        }`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'make-ready' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="Unit Turnaround Specs" className="space-y-4">
                            <Input label="Unit Size (Sq Ft)" type="number" value={unitSqft} onChange={e => setUnitSqft(e.target.value)} placeholder="e.g. 800" />
                            <div className="space-y-3 mt-4">
                                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <input type="checkbox" checked={paintNeeded} onChange={e => setPaintNeeded(e.target.checked)} className="h-5 w-5 rounded text-indigo-600" />
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Full Interior Paint</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <input type="checkbox" checked={carpetNeeded} onChange={e => setCarpetNeeded(e.target.checked)} className="h-5 w-5 rounded text-indigo-600" />
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Replace Flooring/Carpet</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <input type="checkbox" checked={deepCleanNeeded} onChange={e => setDeepCleanNeeded(e.target.checked)} className="h-5 w-5 rounded text-indigo-600" />
                                    <span className="font-bold text-slate-700 dark:text-slate-300">Deep Cleaning</span>
                                </label>
                            </div>
                        </Card>
                        <Card title="Make-Ready Projection" className="flex flex-col justify-center items-center bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100">
                            <Building size={48} className="text-indigo-200 mb-4" />
                            <div className="text-center mb-6">
                                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">Estimated Turnaround</p>
                                <p className="text-5xl font-black text-indigo-700">{makeReadyEstimate.days} Days</p>
                            </div>
                            <div className="text-center border-t border-indigo-200 pt-4 w-full">
                                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">Estimated Cost</p>
                                <p className="text-3xl font-black text-slate-700 dark:text-white">${makeReadyEstimate.cost.toFixed(2)}</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'roi' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card title="CapEx ROI Calculator" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-bold text-sm mb-2 text-slate-700">Repair Option</h4>
                                    <Input label="Cost ($)" type="number" value={repairCost} onChange={e => setRepairCost(e.target.value)} />
                                    <div className="mt-2" />
                                    <Input label="Expected Added Life (Yrs)" type="number" value={expectedLifeRepair} onChange={e => setExpectedLifeRepair(e.target.value)} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm mb-2 text-slate-700">Replace Option</h4>
                                    <Input label="Cost ($)" type="number" value={replacementCost} onChange={e => setReplacementCost(e.target.value)} />
                                    <div className="mt-2" />
                                    <Input label="Expected Life (Yrs)" type="number" value={expectedLifeReplace} onChange={e => setExpectedLifeReplace(e.target.value)} />
                                </div>
                            </div>
                        </Card>
                        <Card title="Analysis & Recommendation" className="bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-center p-6 gap-4">
                            <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Amortized Repair</p>
                                    <p className="text-xl font-black text-slate-700 dark:text-white">${roiAnalysis.repairCostPerYear.toFixed(2)} / yr</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-700 rounded-xl shadow-sm">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Amortized Replacement</p>
                                    <p className="text-xl font-black text-slate-700 dark:text-white">${roiAnalysis.replaceCostPerYear.toFixed(2)} / yr</p>
                                </div>
                            </div>
                            <div className={`mt-4 p-4 rounded-xl text-center border-2 ${roiAnalysis.recommendation === 'Replace' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                <p className="text-sm font-bold uppercase tracking-wider mb-1">Recommendation</p>
                                <p className="text-3xl font-black">{roiAnalysis.recommendation}</p>
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'vendors' && (
                    <Card title="Preferred Vendor Matrix" className="space-y-4">
                        <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <Users className="text-slate-400" size={32} />
                            <p className="text-slate-500 text-sm">Vendor performance tracking, dispatch automation, and compliance monitoring coming in the next update.</p>
                        </div>
                    </Card>
                )}
            </div>

            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Save Analysis to Property Record">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Save current data to the digital property log.</p>
                    <Select label="Select Target Property Job" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                        <option value="">-- Choose an active job/work order --</option>
                        {activeJobs.map(j => <option key={j.id} value={j.id}>{j.customerName} - {formatAddress(j.address)}</option>)}
                    </Select>
                    <Button onClick={handleSaveToJob} disabled={!selectedJobId || isSaving} className="w-full bg-indigo-600">
                        {isSaving ? 'Saving...' : 'Confirm & Save'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default PropertyManagementTools;
