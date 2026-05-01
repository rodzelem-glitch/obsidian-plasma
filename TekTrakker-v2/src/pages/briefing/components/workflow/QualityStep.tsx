import React from 'react';
import { ShieldCheck, Camera, ClipboardList, Import } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Textarea from '../../../../components/ui/Textarea';
import { VoiceInput } from '../../../../components/ui/VoiceInput';

interface ChecklistItem {
    id: string;
    label: string;
    completed: boolean;
    hiddenFromCustomer?: boolean;
}

interface QualityStepProps {
    setIsQCOpen: (open: boolean) => void;
    setIsImportModalOpen: (open: boolean) => void;
    checklists: ChecklistItem[];
    toggleChecklistItem: (id: string) => void;
    toggleChecklistVisibility?: (id: string) => void;
    toggleAllChecklistVisibility?: (hideMode: boolean) => void;
    completionNotes: string;
    setCompletionNotes: (notes: string) => void;
    customerFeedback: string;
    setCustomerFeedback: (feedback: string) => void;
    membershipOffered?: boolean;
    setMembershipOffered?: (val: boolean) => void;
    hidden?: boolean;
}

const QualityStep: React.FC<QualityStepProps> = ({
    setIsQCOpen,
    setIsImportModalOpen,
    checklists,
    toggleChecklistItem,
    toggleChecklistVisibility,
    toggleAllChecklistVisibility,
    completionNotes,
    setCompletionNotes,
    customerFeedback,
    setCustomerFeedback,
    membershipOffered,
    setMembershipOffered,
    hidden
}) => {
    if (hidden) return null;
    return (
        <div className="space-y-6 text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={48} className="text-slate-400"/>
            </div>
            <h3 className="text-xl font-bold">Quality Check</h3>
            <Button onClick={() => setIsQCOpen(true)} className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2 mb-4">
                <Camera size={20}/> Launch AI Inspector (Optional)
            </Button>
            
            <Card className="text-left">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold flex items-center gap-2">
                        <ClipboardList size={18} className="text-primary-600"/> Quality Checklist
                    </h4>
                    <div className="flex items-center gap-2">
                        {toggleAllChecklistVisibility && checklists.length > 0 && (
                            <>
                                <button onClick={() => toggleAllChecklistVisibility(false)} className="text-[10px] uppercase font-black text-primary-600 hover:underline">Show All</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={() => toggleAllChecklistVisibility(true)} className="text-[10px] uppercase font-black text-slate-400 hover:underline">Hide All</button>
                            </>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setIsImportModalOpen(true)} className="text-xs flex items-center gap-1 ml-2">
                            <Import size={14}/> Import
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
                                        title={item.hiddenFromCustomer ? "Hidden from Customer Portal" : "Visible in Customer Portal"}
                                    >
                                        {item.hiddenFromCustomer ? 'Hidden' : 'Visible'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed rounded-lg bg-slate-50">
                        <p className="text-xs text-slate-400">No checklist items yet. Import from documents.</p>
                    </div>
                )}
            </Card>

            <Card className="text-left">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">Job Completion Notes</h4>
                    <VoiceInput onResult={(text) => setCompletionNotes(completionNotes + ' ' + text)} />
                </div>
                <Textarea 
                    rows={3} 
                    value={completionNotes} 
                    onChange={e => setCompletionNotes(e.target.value)} 
                    placeholder="Summary for invoice..." 
                />
            </Card>

            <Card className="text-left bg-purple-50 border-purple-200">
                <h4 className="font-bold mb-2 text-purple-700 flex items-center gap-2">
                    <span className="sparkles-icon">✨</span> Membership Reminder
                </h4>
                <p className="text-xs text-purple-600 mb-2">Did you offer the customer a membership plan to save money on today's visit?</p>
                <label className="flex items-center gap-3 p-2 bg-white rounded border border-purple-200 cursor-pointer mt-2">
                    <input 
                        type="checkbox" 
                        checked={membershipOffered || false} 
                        onChange={(e) => setMembershipOffered && setMembershipOffered(e.target.checked)}
                        className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-semibold text-purple-800">
                        Yes, I discussed a membership plan with the customer
                    </span>
                </label>
            </Card>

            <Card className="text-left">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold">Customer Feedback</h4>
                    <VoiceInput onResult={(text) => setCustomerFeedback(customerFeedback + ' ' + text)} />
                </div>
                <Textarea 
                    rows={2} 
                    value={customerFeedback} 
                    onChange={e => setCustomerFeedback(e.target.value)} 
                    placeholder="Customer comments..." 
                />
            </Card>
        </div>
    );
};

export default QualityStep;
