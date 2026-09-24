import React, { useState } from 'react';
import { ShieldCheck, Camera, ClipboardList, Import, Wrench, Heart, FileText } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { useLanguage } from 'context/LanguageContext';
import { useAppContext } from 'context/AppContext';
import { isHvacTrade } from '../../../../utils/tradeResolver';
import { globalConfirm } from '../../../../lib/globalConfirm';

interface ChecklistItem {
    id: string;
    label: string;
    completed: boolean;
    hiddenFromCustomer?: boolean;
}

interface QualityStepProps {
    setIsImportModalOpen: (open: boolean) => void;
    checklists: ChecklistItem[];
    toggleChecklistItem: (id: string) => void;
    toggleChecklistVisibility?: (id: string) => void;
    toggleAllChecklistVisibility?: (hideMode: boolean) => void;
    onCheckAll?: () => void;
    completionNotes: string;
    setCompletionNotes: (notes: string) => void;
    customerFeedback: string;
    setCustomerFeedback: (feedback: string) => void;
    membershipOffered?: boolean;
    setMembershipOffered?: (val: boolean) => void;
    techRecommendations: string;
    setTechRecommendations: (val: string) => void;
    thankYouNote: string;
    setThankYouNote: (val: string) => void;
    hidden?: boolean;
    verificationOutcome?: any;
    setVerificationOutcome?: (val: any) => void;
    hvacType?: string | null;
    job?: any;
}

const QualityStep: React.FC<QualityStepProps> = ({
    setIsImportModalOpen,
    checklists,
    toggleChecklistItem,
    toggleChecklistVisibility,
    toggleAllChecklistVisibility,
    onCheckAll,
    completionNotes,
    setCompletionNotes,
    customerFeedback,
    setCustomerFeedback,
    membershipOffered,
    setMembershipOffered,
    techRecommendations,
    setTechRecommendations,
    thankYouNote,
    setThankYouNote,
    hidden = false,
    verificationOutcome = {},
    setVerificationOutcome,
    hvacType,
    job,
}) => {
    const { t } = useLanguage();
    const { state } = useAppContext();
    const isHvac = isHvacTrade(job, state.currentOrganization);
    const [activeNotesTab, setActiveNotesTab] = useState<'completion' | 'recommendations' | 'thankyou'>('completion');

    const handleUpdateOutcomeField = (field: string, value: any) => {
        if (setVerificationOutcome) {
            setVerificationOutcome({
                ...verificationOutcome,
                [field]: value
            });
        }
    };

    if (hidden) return null;
    return (
        <div className="space-y-6 text-center">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={48} className="text-slate-400"/>
            </div>
            <h3 className="text-xl font-bold">{t("Quality Check & Verification")}</h3>
            
            {/* Repair Verification Outcomes Card */}
            <Card className="text-left bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-600 dark:text-blue-400" />
                    {t("Repair Verification Outcome (Required)")}
                </h4>
                <p className="text-xs text-slate-500 mb-4">{t("Select the verified operational outcome of the repair before completing work.")}</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{t("Outcome Status")}</label>
                        <select 
                            value={verificationOutcome.outcome || ''} 
                            onChange={e => handleUpdateOutcomeField('outcome', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 font-semibold text-sm text-slate-800 dark:text-slate-100"
                        >
                            <option value="">{t("-- Select Verification Outcome --")}</option>
                            <option value="Repair Verified — Operating Properly">🟢 {t("Repair Verified — Operating Properly")}</option>
                            <option value="Repair Completed — Additional Concern Found">🟡 {t("Repair Completed — Additional Concern Found")}</option>
                            <option value="Temporary Repair Only">🟠 {t("Temporary Repair Only")}</option>
                            <option value="Unable to Verify">⚪ {t("Unable to Verify")}</option>
                            <option value="Equipment Not Operational">🔴 {t("Equipment Not Operational")}</option>
                            <option value="Return Visit Required">🔵 {t("Return Visit Required")}</option>
                        </select>
                    </div>

                    {/* Conditional Verification Readings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-blue-200/60 dark:border-blue-900/60">
                        {isHvac ? (
                            <>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{t("Final Temperature Split (°F)")}</label>
                                    <input 
                                        type="text"
                                        placeholder={t("e.g. Supply 55°F / Return 72°F (17°F split)")}
                                        value={verificationOutcome.tempSplit || ''}
                                        onChange={e => handleUpdateOutcomeField('tempSplit', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{t("Electrical Readings (Volts/Amps)")}</label>
                                    <input 
                                        type="text"
                                        placeholder={t("e.g. L1-L2 238V, Compressor 14.2A")}
                                        value={verificationOutcome.electricalReadings || ''}
                                        onChange={e => handleUpdateOutcomeField('electricalReadings', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{t("Refrigerant Operating Pressures")}</label>
                                    <input 
                                        type="text"
                                        placeholder={t("e.g. Suction 125 psi, Liquid 340 psi")}
                                        value={verificationOutcome.refrigerantReadings || ''}
                                        onChange={e => handleUpdateOutcomeField('refrigerantReadings', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{t("Tool / Field Diagnostic Readings (Volts, Amps, Resistance, Specs)")}</label>
                                <input 
                                    type="text"
                                    placeholder={t("e.g. 120V / 12A, 1.2 Ohms, Torque/Pressure verified")}
                                    value={verificationOutcome.electricalReadings || ''}
                                    onChange={e => handleUpdateOutcomeField('electricalReadings', e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                                />
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{t("Drain")}</label>
                                <select 
                                    value={verificationOutcome.drainOperation || 'Pass'}
                                    onChange={e => handleUpdateOutcomeField('drainOperation', e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                                >
                                    <option value="Pass">Pass</option>
                                    <option value="Fail">Fail</option>
                                    <option value="N/A">N/A</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{t("Thermostat")}</label>
                                <select 
                                    value={verificationOutcome.thermostatOperation || 'Pass'}
                                    onChange={e => handleUpdateOutcomeField('thermostatOperation', e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                                >
                                    <option value="Pass">Pass</option>
                                    <option value="Fail">Fail</option>
                                    <option value="N/A">N/A</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{t("Safeties")}</label>
                                <select 
                                    value={verificationOutcome.safetyControlOperation || 'Pass'}
                                    onChange={e => handleUpdateOutcomeField('safetyControlOperation', e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold"
                                >
                                    <option value="Pass">Pass</option>
                                    <option value="Fail">Fail</option>
                                    <option value="N/A">N/A</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="text-left">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold flex items-center gap-2">
                        <ClipboardList size={18} className="text-primary-600"/> {t("Quality Checklist")}
                    </h4>
                    <div className="flex items-center gap-2">
                        {checklists.length > 0 && (
                            <div className="flex items-center gap-2 mr-2">
                                {toggleAllChecklistVisibility && (
                                    <>
                                        <button onClick={() => toggleAllChecklistVisibility(false)} className="text-[10px] uppercase font-black text-primary-600 hover:underline">{t("Show All")}</button>
                                        <span className="text-slate-300">|</span>
                                        <button onClick={() => toggleAllChecklistVisibility(true)} className="text-[10px] uppercase font-black text-slate-400 hover:underline">{t("Hide All")}</button>
                                        <span className="text-slate-300">|</span>
                                    </>
                                )}
                                {onCheckAll && (
                                    <button 
                                        onClick={async () => {
                                            if (await globalConfirm(t("Are you sure you want to mark all checklist items as completed? Please confirm you have physically performed these checks."), t("Complete All Checks"), t("Check All"), t("Cancel"))) {
                                                onCheckAll();
                                            }
                                        }} 
                                        className="text-[10px] uppercase font-black text-emerald-600 hover:underline cursor-pointer"
                                    >
                                        {t("Check All")}
                                    </button>
                                )}
                            </div>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setIsImportModalOpen(true)} className="text-xs flex items-center gap-1">
                            <Import size={14}/> {t("Import")}
                        </Button>
                    </div>
                </div>
                {checklists.length > 0 ? (
                    <div className="space-y-2">
                        {checklists.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded border hover:bg-slate-100 transition-colors">
                                <label className="flex items-center gap-3 cursor-pointer flex-1">
                                    <input 
                                        type="checkbox" 
                                        checked={item.completed} 
                                        onChange={() => toggleChecklistItem(item.id)}
                                        className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className={`text-sm ${item.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {item.label}
                                    </span>
                                </label>
                                {toggleChecklistVisibility && (
                                    <button 
                                        onClick={() => toggleChecklistVisibility(item.id)}
                                        className={`ml-2 text-[10px] font-bold px-2 py-1 rounded transition-colors shrink-0 ${item.hiddenFromCustomer ? 'bg-slate-200 text-slate-500 line-through dark:bg-slate-700 dark:text-slate-400' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 border border-primary-200 dark:border-primary-800'}`}
                                        title={item.hiddenFromCustomer ? t("Hidden from Customer Portal") : t("Visible in Customer Portal")}
                                    >
                                        {item.hiddenFromCustomer ? t("Hidden") : t("Visible")}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed rounded-lg bg-slate-50">
                        <p className="text-xs text-slate-400">{t("No checklist items yet. Import from documents.")}</p>
                    </div>
                )}
            </Card>

            {/* Unified 3-Tab Notes Card */}
            <Card className="p-0 overflow-hidden text-left border border-slate-200 dark:border-slate-800">
                {/* Tab Headers */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveNotesTab('completion')}
                        className={`flex-1 py-3 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                            activeNotesTab === 'completion'
                                ? 'border-emerald-600 text-emerald-600 bg-white dark:bg-slate-900 dark:text-emerald-400 font-extrabold'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <FileText size={15} />
                        <span>{t("Completion Notes")}</span>
                        {completionNotes.trim() ? <span className="w-2 h-2 rounded-full bg-emerald-500" /> : null}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveNotesTab('recommendations')}
                        className={`flex-1 py-3 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                            activeNotesTab === 'recommendations'
                                ? 'border-purple-600 text-purple-600 bg-white dark:bg-slate-900 dark:text-purple-400 font-extrabold'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Wrench size={15} />
                        <span>{t("Direct Recommendations")}</span>
                        {techRecommendations.trim() ? <span className="w-2 h-2 rounded-full bg-purple-500" /> : null}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveNotesTab('thankyou')}
                        className={`flex-1 py-3 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                            activeNotesTab === 'thankyou'
                                ? 'border-blue-600 text-blue-600 bg-white dark:bg-slate-900 dark:text-blue-400 font-extrabold'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Heart size={15} />
                        <span>{t("Thank You Note")}</span>
                        {thankYouNote.trim() ? <span className="w-2 h-2 rounded-full bg-blue-500" /> : null}
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-4">
                    {activeNotesTab === 'completion' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                                    🔒 VISIBILITY: CUSTOMER / INVOICE / JOB RECORD HISTORY
                                </span>
                                <VoiceInput onResult={(text) => setCompletionNotes(completionNotes + ' ' + text)} />
                            </div>
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">{t("Job Completion Notes")}</h4>
                            <Textarea 
                                rows={4} 
                                value={completionNotes} 
                                onChange={e => setCompletionNotes(e.target.value)} 
                                placeholder={t("Summary for invoice...")} 
                                className="bg-white dark:bg-slate-900 text-xs"
                            />
                        </div>
                    )}

                    {activeNotesTab === 'recommendations' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300">
                                    🔒 VISIBILITY: PROPERTY MANAGER / CUSTOMER / PROPOSAL / INVOICE
                                </span>
                                <VoiceInput onResult={(text) => setTechRecommendations(techRecommendations + ' ' + text)} />
                            </div>
                            <h4 className="font-extrabold text-xs text-purple-900 dark:text-purple-300 uppercase tracking-wider">{t("Direct Technician Recommendations")}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t("These recommendations push directly to the customer portal and job history immediately, bypassing any billing or proposal gates.")}
                            </p>
                            <Textarea 
                                rows={4} 
                                value={techRecommendations} 
                                onChange={e => setTechRecommendations(e.target.value)} 
                                placeholder={t("Enter recommendations for the customer/property manager...")} 
                                className="bg-white dark:bg-slate-900 text-xs"
                            />
                        </div>
                    )}

                    {activeNotesTab === 'thankyou' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300">
                                    🔒 VISIBILITY: CUSTOMER MESSAGE
                                </span>
                                <VoiceInput onResult={(text) => setThankYouNote(thankYouNote + ' ' + text)} />
                            </div>
                            <h4 className="font-extrabold text-xs text-blue-900 dark:text-blue-300 uppercase tracking-wider">{t("Technician Thank You Note")}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t("Personalize a thank you message to show on the customer's job report.")}
                            </p>
                            <Textarea 
                                rows={4} 
                                value={thankYouNote} 
                                onChange={e => setThankYouNote(e.target.value)} 
                                placeholder={t("e.g. Thank you for your business! It was a pleasure servicing your equipment today. Please let us know if you need anything else.")} 
                                className="bg-white dark:bg-slate-900 text-xs"
                            />
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default QualityStep;
