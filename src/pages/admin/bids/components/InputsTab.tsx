
import React, { useState, useEffect } from 'react';
import Textarea from 'components/ui/Textarea';
import Button from 'components/ui/Button';
import { BidQuestion } from 'types';
import { AlertTriangle } from 'lucide-react';

interface InputsTabProps {
    questions: BidQuestion[];
    answers: Record<string, string>;
    onSave: (answers: Record<string, string>) => void;
}

const InputsTab: React.FC<InputsTabProps> = ({ questions, answers, onSave }) => {
    // 1. Create a local state to hold the answers while the user is typing
    const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});

    // 2. Sync the local state with the props when the component mounts or when external answers change
    useEffect(() => {
        setLocalAnswers(answers);
    }, [answers]);

    // 3. Handle typing by updating the local state ONLY. This is instant and prevents lag.
    const handleLocalChange = (id: string, value: string) => {
        setLocalAnswers(prev => ({
            ...prev,
            [id]: value
        }));
    };

    // 4. When they click save, push all local changes up to the parent component (and Firestore)
    const handleSaveClick = () => {
        onSave(localAnswers);
    };

    return (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
            <h4 className="font-bold text-lg mb-2 text-amber-900 dark:text-amber-500 flex items-center gap-2">
                <AlertTriangle size={20}/> Action Required: Inputs & Questions
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                The AI requires your input for the proposal. Please answer thoroughly. Your changes are saved locally as you type. <strong className="text-amber-700 dark:text-amber-400">You MUST click 'Save Answers' to sync them before generating.</strong>
            </p>
            <div className="space-y-4">
                {questions.map((q) => (
                    <div key={q.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm focus-within:border-amber-400 transition-colors">
                        <p className="text-sm font-bold mb-2 text-slate-800 dark:text-slate-200">{q.question}</p>
                        <Textarea 
                            placeholder="Your answer..." 
                            value={localAnswers[q.id] || ''} 
                            onChange={e => handleLocalChange(q.id, e.target.value)} 
                            rows={3}
                            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                    </div>
                ))}
            </div>
            {questions.length > 0 && (
                <div className="mt-6 flex justify-end">
                    <Button onClick={handleSaveClick} className="bg-amber-600 hover:bg-amber-700 text-white">
                        Save Answers
                    </Button>
                </div>
            )}
        </div>
    );
};

export default InputsTab;
