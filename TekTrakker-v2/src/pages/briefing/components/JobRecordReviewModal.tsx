import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useLanguage } from '../../../context/LanguageContext';
import { Job, StoredFile } from '../../../types';
import { 
    FileText, CheckCircle2, ShieldCheck, User, Clock, Wrench, 
    Package, Thermometer, AlertTriangle, Check, MapPin, Calendar, 
    ClipboardList, FileCheck, Layers, Droplets
} from 'lucide-react';

interface JobRecordReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    workflowState: any;
    files?: StoredFile[];
    assets?: any[];
    onSignOff: (signedOffBy: string, notes?: string) => void;
    isSignedOff: boolean;
    signedOffAt?: string;
    signedOffBy?: string;
    signedOffNotes?: string;
}

const JobRecordReviewModal: React.FC<JobRecordReviewModalProps> = ({
    isOpen,
    onClose,
    job,
    workflowState,
    files = [],
    assets = [],
    onSignOff,
    isSignedOff,
    signedOffAt,
    signedOffBy,
    signedOffNotes
}) => {
    const { t } = useLanguage();

    const [certified, setCertified] = useState(isSignedOff);
    const [techName, setTechName] = useState(
        signedOffBy || job.assignedTechnicianName || ''
    );
    const [notes, setNotes] = useState(signedOffNotes || '');
    const [activeTab, setActiveTab] = useState<'all' | 'diagnostics' | 'repair' | 'quality'>('all');

    const partsUsed = Array.isArray(workflowState?.partsUsed) ? workflowState.partsUsed : (Array.isArray(job.partsUsed) ? job.partsUsed : (job.partsUsed ? [job.partsUsed] : []));
    const rawReadings = workflowState?.toolReadings || job.toolReadings || job.readings;
    const toolReadings = Array.isArray(rawReadings) ? rawReadings : (rawReadings && typeof rawReadings === 'object' ? [rawReadings] : []);
    const refrigerantLog = Array.isArray(workflowState?.refrigerantLog) ? workflowState.refrigerantLog : (Array.isArray(job.refrigerantLog) ? job.refrigerantLog : (job.refrigerantLog ? [job.refrigerantLog] : []));
    const diagnosisChecklist = (workflowState?.diagnosisChecklist || []);
    const qualityChecklist = (workflowState?.qualityChecklist || []);
    const unitStates = (workflowState?.unitStates || []);

    const handleConfirmSignOff = () => {
        if (!certified) return;
        onSignOff(techName.trim() || job.assignedTechnicianName || 'Technician', notes);
        onClose();
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={t("Full Job Record Review & Sign-Off")}
        >
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 text-left custom-scrollbar">
                {/* Header Banner */}
                <div className={`p-4 rounded-xl border-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                    isSignedOff 
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-900 dark:text-emerald-200' 
                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-200'
                }`}>
                    <div>
                        <div className="flex items-center gap-2">
                            {isSignedOff ? (
                                <ShieldCheck className="text-emerald-600 dark:text-emerald-400 shrink-0" size={24} />
                            ) : (
                                <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 animate-bounce" size={24} />
                            )}
                            <h3 className="font-extrabold text-lg">
                                {isSignedOff ? t("Job Record Signed Off & Certified") : t("Technician Sign-Off Required")}
                            </h3>
                        </div>
                        <p className="text-xs opacity-90 mt-1">
                            {isSignedOff && signedOffAt ? (
                                `${t("Certified by")} ${signedOffBy || t("Technician")} ${t("on")} ${new Date(signedOffAt).toLocaleString()}`
                            ) : (
                                t("Review all documented work, notes, tool readings, and installed parts below before final sign-off.")
                            )}
                        </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-black rounded-full uppercase tracking-wider shrink-0 ${
                        isSignedOff 
                            ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100' 
                            : 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-100'
                    }`}>
                        {isSignedOff ? t("Signed Off") : t("Pending Sign-Off")}
                    </span>
                </div>

                {/* Section Filter Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                            activeTab === 'all'
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        {t("All Sections")}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('diagnostics')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                            activeTab === 'diagnostics'
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        {t("Diagnostics & Tool Readings")}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('repair')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                            activeTab === 'repair'
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        {t("Work & Parts Log")}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('quality')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                            activeTab === 'quality'
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                    >
                        {t("Quality & Completion")}
                    </button>
                </div>

                {/* Section 1: Customer & Job Overview */}
                {(activeTab === 'all') && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                            <User size={18} className="text-primary-500" />
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Customer & Site Details")}</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-slate-400 block font-medium">{t("Customer Name")}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{job.customerName || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-medium">{t("Service Location")}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <MapPin size={12} className="text-slate-400 shrink-0" />
                                    {typeof job.serviceLocationAddress === 'string' ? job.serviceLocationAddress : (job.address || 'N/A')}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-medium">{t("Job / Work Order #")}</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{job.poNumber || job.workOrderNumber || job.id}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-medium">{t("Visit Type")}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{job.visitType || 'Standard Visit'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-medium">{t("Check-In Time")}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {workflowState?.checkInTime ? new Date(workflowState.checkInTime).toLocaleString() : (job.checkInTime ? new Date(job.checkInTime).toLocaleString() : t("Not Checked In"))}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block font-medium">{t("Time On Site")}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {workflowState?.checkInTime 
                                        ? `${Math.round((Date.now() - new Date(workflowState.checkInTime).getTime()) / 60000)} ${t("minutes")}` 
                                        : (job.timeOnSiteMinutes ? `${job.timeOnSiteMinutes} ${t("minutes")}` : t("Active Shift"))}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Section 2: Serviced Assets & Equipment */}
                {(activeTab === 'all') && assets && assets.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                            <Layers size={18} className="text-blue-500" />
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Serviced Equipment / Assets")} ({assets.length})</h4>
                        </div>
                        <div className="space-y-2">
                            {assets.map((asset, idx) => {
                                const unitState = unitStates.find((s: any) => s.assetId === asset.id || s.assetId === asset.name);
                                return (
                                    <div key={asset.id || idx} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                        <div>
                                            <span className="font-extrabold text-slate-800 dark:text-slate-200">{asset.name || asset.type || `Asset #${idx + 1}`}</span>
                                            {asset.serialNumber && <span className="text-slate-400 ml-2">S/N: {asset.serialNumber}</span>}
                                            {asset.modelNumber && <span className="text-slate-400 ml-2">Model: {asset.modelNumber}</span>}
                                        </div>
                                        {unitState && (
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider self-start sm:self-auto ${
                                                unitState.health === 'Good' || unitState.unitHealth === 'Operational' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                                unitState.health === 'Fair' || unitState.unitHealth === 'Needs Attention' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' :
                                                'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                            }`}>
                                                {t("Health")}: {unitState.health || unitState.unitHealth || 'Normal'}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Section 3: Arrival & Diagnostics */}
                {(activeTab === 'all' || activeTab === 'diagnostics') && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                            <Thermometer size={18} className="text-purple-500" />
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Arrival & Diagnostic Findings")}</h4>
                        </div>
                        
                        {workflowState?.arrivalNotes && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("Arrival Notes")}</span>
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {workflowState.arrivalNotes}
                                </div>
                            </div>
                        )}

                        {workflowState?.diagnosisNotes && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("Diagnosis Notes")}</span>
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {workflowState.diagnosisNotes}
                                </div>
                            </div>
                        )}

                        {/* Tool Readings */}
                        {toolReadings.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{t("Diagnostic Tool Readings")} ({toolReadings.length})</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {toolReadings.map((reading: any, idx: number) => (
                                        <div key={idx} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                                            <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                                                <span>{reading.label || reading.type || reading.name || t("Reading")}</span>
                                                <span className="text-purple-600 dark:text-purple-400">{reading.value} {reading.unit || ''}</span>
                                            </div>
                                            {reading.notes && <p className="text-[11px] text-slate-400 mt-1">{reading.notes}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Refrigerant Log */}
                        {refrigerantLog.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{t("Refrigerant Log")}</span>
                                <div className="space-y-1.5">
                                    {refrigerantLog.map((log: any, idx: number) => (
                                        <div key={idx} className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex justify-between">
                                            <span className="font-bold">{log.refrigerantType || log.type} ({log.action || 'Usage'})</span>
                                            <span className="font-extrabold text-blue-600">{log.amount || log.amountLbs || 0} {log.unit || 'lbs'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Diagnosis Checklist */}
                        {diagnosisChecklist.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{t("Diagnosis Checklist")}</span>
                                <div className="space-y-1">
                                    {diagnosisChecklist.map((item: any, idx: number) => (
                                        <div key={item.id || idx} className="flex items-center gap-2 text-xs">
                                            <CheckCircle2 size={14} className={item.completed ? 'text-emerald-500' : 'text-slate-300'} />
                                            <span className={item.completed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 line-through'}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Section 4: Work & Parts Completed */}
                {(activeTab === 'all' || activeTab === 'repair') && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                            <Wrench size={18} className="text-emerald-500" />
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Repair & Work Performed")}</h4>
                        </div>

                        {workflowState?.repairPostponed && (
                            <div className="p-3 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                                <strong>{t("Notice")}:</strong> {t("Repair work was marked as postponed.")} {workflowState.repairPostponedReason && `(${t("Reason")}: ${workflowState.repairPostponedReason})`}
                            </div>
                        )}

                        {(workflowState?.workNotes || workflowState?.repairNotes) && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("Work Notes / Repair Details")}</span>
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {workflowState.workNotes || workflowState.repairNotes}
                                </div>
                            </div>
                        )}

                        {/* Installed Parts & Materials */}
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{t("Installed Parts & Materials Log")} ({partsUsed.length})</span>
                            {partsUsed.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">{t("No parts or materials logged for this visit.")}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                <th className="p-2 rounded-l-lg">{t("Item Name")}</th>
                                                <th className="p-2 text-center">{t("Qty")}</th>
                                                <th className="p-2 text-right rounded-r-lg">{t("SKU / Part #")}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {partsUsed.map((part: any, idx: number) => (
                                                <tr key={part.id || idx}>
                                                    <td className="p-2 font-bold text-slate-700 dark:text-slate-300">{part.name || part.partName}</td>
                                                    <td className="p-2 text-center font-extrabold">{part.quantity || part.qty || 1}</td>
                                                    <td className="p-2 text-right text-slate-400">{part.sku || part.partNumber || 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Section 5: Quality & Completion */}
                {(activeTab === 'all' || activeTab === 'quality') && (
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                            <FileCheck size={18} className="text-indigo-500" />
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Quality QC & Completion")}</h4>
                        </div>

                        {(workflowState?.completionNotes || workflowState?.qualityNotes) && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("Completion Notes")}</span>
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {workflowState.completionNotes || workflowState.qualityNotes}
                                </div>
                            </div>
                        )}

                        {workflowState?.techRecommendations && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">{t("Technician Recommendations")}</span>
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {workflowState.techRecommendations}
                                </div>
                            </div>
                        )}

                        {/* Quality QC Checklist */}
                        {qualityChecklist.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{t("Quality QC Checklist")}</span>
                                <div className="space-y-1">
                                    {qualityChecklist.map((item: any, idx: number) => (
                                        <div key={item.id || idx} className="flex items-center gap-2 text-xs">
                                            <CheckCircle2 size={14} className={item.completed ? 'text-emerald-500' : 'text-slate-300'} />
                                            <span className={item.completed ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 line-through'}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Attachments / Photos summary */}
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                            <span className="font-bold text-slate-600 dark:text-slate-400">{t("Job Photos & Files Uploaded")}:</span>
                            <span className="font-black text-primary-600">{files.length} {t("files")}</span>
                        </div>
                    </div>
                )}

                {/* Technician Certification & Sign-Off Form */}
                <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-lg space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
                        <ShieldCheck size={22} className="text-emerald-400" />
                        <div>
                            <h4 className="font-black text-base uppercase tracking-wider text-white">{t("Technician Job Record Certification")}</h4>
                            <p className="text-xs text-slate-300">{t("Final sign-off by technician prior to departing job site.")}</p>
                        </div>
                    </div>

                    <label className="flex items-start gap-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors">
                        <input
                            type="checkbox"
                            checked={certified}
                            onChange={(e) => setCertified(e.target.checked)}
                            className="mt-1 w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-200 leading-relaxed">
                            {t("I certify that I have thoroughly reviewed this complete job record, including all diagnostic readings, work notes, installed parts, and quality checks, and confirm that all details are accurate.")}
                        </span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">{t("Technician Signature Name")}</label>
                            <input 
                                type="text"
                                value={techName}
                                onChange={(e) => setTechName(e.target.value)}
                                placeholder={t("Enter technician name")}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-300 block mb-1">{t("Sign-Off Notes / Remarks (Optional)")}</label>
                            <input 
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder={t("Optional verification notes")}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
                        <Button 
                            variant="secondary" 
                            onClick={onClose} 
                            className="text-xs !bg-slate-800 hover:!bg-slate-700 !text-slate-300"
                        >
                            {t("Close Review")}
                        </Button>
                        <Button 
                            onClick={handleConfirmSignOff}
                            disabled={!certified}
                            className={`text-xs font-black px-5 py-2.5 flex items-center gap-1.5 !rounded-lg ${
                                certified 
                                    ? '!bg-emerald-500 hover:!bg-emerald-600 !text-slate-950 shadow-md cursor-pointer' 
                                    : '!bg-slate-700 !text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            <Check size={16} />
                            {isSignedOff ? t("Update Sign-Off") : t("Confirm & Sign Off Job Record")}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default JobRecordReviewModal;
