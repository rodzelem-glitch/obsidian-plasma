import React from 'react';
import { ShieldCheck, Camera, ClipboardList, Import, Wrench, Heart } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';
import { useLanguage } from 'context/LanguageContext';

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
    hidden
}) => {
    const { t } = useLanguage();


    if (hidden) return null;
    return (
        <div className="space-y-6 text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={48} className="text-slate-400"/>
            </div>
            <h3 className="text-xl font-bold">{t("Quality Check")}</h3>
            
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
                                        onClick={() => {
                                            if (window.confirm(t("Are you sure you want to mark all checklist items as completed? Please confirm you have physically performed these checks."))) {
                                                onCheckAll();
                                            }
                                        }} 
                                        className="text-[10px] uppercase font-black text-emerald-600 hover:underline"
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

            <Card className="text-left">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">{t("Job Completion Notes")}</h4>
                    <VoiceInput onResult={(text) => setCompletionNotes(completionNotes + ' ' + text)} />
                </div>
                <Textarea 
                    rows={3} 
                    value={completionNotes} 
                    onChange={e => setCompletionNotes(e.target.value)} 
                    placeholder={t("Summary for invoice...")} 
                />
            </Card>

            <Card className="text-left bg-purple-50 border-purple-200">
                <h4 className="font-bold mb-2 text-purple-700 flex items-center gap-2">
                    <span className="sparkles-icon">✨</span> {t("Membership Reminder")}
                </h4>
                <p className="text-xs text-purple-600 mb-2">{t("Did you offer the customer a membership plan to save money on today's visit?")}</p>
                <label className="flex items-center gap-3 p-2 bg-white rounded border border-purple-200 cursor-pointer mt-2">
                    <input 
                        type="checkbox" 
                        checked={membershipOffered || false} 
                        onChange={(e) => setMembershipOffered && setMembershipOffered(e.target.checked)}
                        className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-semibold text-purple-800">
                        {t("Yes, I discussed a membership plan with the customer")}
                    </span>
                </label>
            </Card>

            <Card className="text-left">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">{t("Customer Feedback")}</h4>
                    <VoiceInput onResult={(text) => setCustomerFeedback(customerFeedback + ' ' + text)} />
                </div>
                <Textarea 
                    rows={2} 
                    value={customerFeedback} 
                    onChange={e => setCustomerFeedback(e.target.value)} 
                    placeholder={t("Customer comments...")} 
                />
            </Card>

            <Card className="text-left bg-emerald-50/30 border-emerald-200/60 dark:bg-emerald-950/10 dark:border-emerald-900/40">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                        <Wrench size={18} className="text-emerald-600 dark:text-emerald-500" />
                        {t("Direct Technician Recommendations")}
                    </h4>
                    <VoiceInput onResult={(text) => setTechRecommendations(techRecommendations + ' ' + text)} />
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-500/80 mb-2">
                    {t("These recommendations push directly to the customer portal and job history immediately, bypassing any billing or proposal gates.")}
                </p>
                <Textarea 
                    rows={3} 
                    value={techRecommendations} 
                    onChange={e => setTechRecommendations(e.target.value)} 
                    placeholder={t("Enter recommendations for the customer/property manager...")} 
                    className="bg-white dark:bg-slate-900 border-emerald-100 dark:border-emerald-900"
                />
            </Card>

            <Card className="text-left bg-indigo-50/30 border-indigo-200/60 dark:bg-indigo-950/10 dark:border-indigo-900/40">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-indigo-800 dark:text-indigo-400 flex items-center gap-2">
                        <Heart size={18} className="text-indigo-600 dark:text-indigo-500" />
                        {t("Technician Thank You Note")}
                    </h4>
                    <VoiceInput onResult={(text) => setThankYouNote(thankYouNote + ' ' + text)} />
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-550/80 mb-2">
                    {t("Personalize a thank you message to show on the customer's job report.")}
                </p>
                <Textarea 
                    rows={3} 
                    value={thankYouNote} 
                    onChange={e => setThankYouNote(e.target.value)} 
                    placeholder={t("e.g. Thank you for your business! It was a pleasure servicing your equipment today. Please let us know if you need anything else.")} 
                    className="bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900"
                />
            </Card>
        </div>
    );
};

export default QualityStep;
