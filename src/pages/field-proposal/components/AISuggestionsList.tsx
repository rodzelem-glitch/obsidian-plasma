
import React from 'react';
import { Plus } from 'lucide-react';
import { AISuggestion, AISuggestionSet } from './AIGenerator';

type Tier = 'Good' | 'Better' | 'Best';

interface AISuggestionsListProps {
    suggestions: AISuggestionSet;
    onAccept: (suggestion: AISuggestion, targetTier: Tier) => void;
}

const AISuggestionsList: React.FC<AISuggestionsListProps> = ({ suggestions, onAccept }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 border-b pb-8">
            {(['Good', 'Better', 'Best'] as Tier[]).map(t => (
                <div key={t} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h5 className="font-black text-xs uppercase text-slate-400 mb-4">{t} Suggestions</h5>
                    <div className="space-y-3">
                        {suggestions[t.toLowerCase() as keyof AISuggestionSet].map((s, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => onAccept(s, t)} 
                                className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-primary-500 transition-all hover:shadow-md group"
                            >
                                <div className="flex justify-between items-start">
                                    <p className="text-sm font-bold group-hover:text-primary-600 transition-colors">{s.name}</p>
                                    <Plus size={14} className="text-slate-300 group-hover:text-primary-500"/>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{s.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AISuggestionsList;
