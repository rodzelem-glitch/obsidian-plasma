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
}

interface QualityStepProps {
    setIsQCOpen: (open: boolean) => void;
    setIsImportModalOpen: (open: boolean) => void;
    checklists: ChecklistItem[];
    toggleChecklistItem: (id: string) => void;
    completionNotes: string;
    setCompletionNotes: (notes: string) => void;
    customerFeedback: string;
    setCustomerFeedback: (feedback: string) => void;
    hidden?: boolean;
}

const QualityStep: React.FC<QualityStepProps> = ({
    setIsQCOpen,
    setIsImportModalOpen,
    checklists,
    toggleChecklistItem,
    completionNotes,
    setCompletionNotes,
    customerFeedback,
    setCustomerFeedback,
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
                <Camera size={20}/> Launch AI Inspector
            </Button>
            
            <Card className="text-left">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold flex items-center gap-2">
                        <ClipboardList size={18} className="text-primary-600"/> Quality Checklist
                    </h4>
                    <Button variant="secondary" size="sm" onClick={() => setIsImportModalOpen(true)} className="text-xs flex items-center gap-1">
                        <Import size={14}/> Import
                    </Button>
                </div>
                {checklists.length > 0 ? (
                    <div className="space-y-2">
                        {checklists.map(item => (
                            <label key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded border hover:bg-slate-100 cursor-pointer transition-colors">
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
