
import React, { useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import Input from 'components/ui/Input';
import Button from 'components/ui/Button';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface AISuggestion {
    name: string;
    description: string;
    baseCost: number;
    avgLabor: number;
}

interface AISuggestionSet {
    good: AISuggestion[];
    better: AISuggestion[];
    best: AISuggestion[];
}

interface AIGeneratorProps {
    onSuggestions: (suggestions: AISuggestionSet) => void;
}

const AIGenerator: React.FC<AIGeneratorProps> = ({ onSuggestions }) => {
    const [problemDesc, setProblemDesc] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    const handleAIEstimate = async () => {
        if (!problemDesc.trim()) return;
        setIsThinking(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            
            const prompt = `Expert Service Estimator: Generate tiered repair options (Good, Better, Best) for the following problem description: "${problemDesc}". 
            Break down each option into parts cost and labor hours for a field technician.
            Provide the response strictly as a valid JSON object with this exact structure:
            {
              "good": [{"name": "string", "description": "string", "baseCost": number, "avgLabor": number}],
              "better": [...],
              "best": [...]
            }`;

            // Using the project's recommended model for complex reasoning
            const result = await callGeminiAI({ 
                prompt, 
                modelName: "gemini-3.1-pro-preview",
                config: {
                    responseMimeType: "application/json"
                }
            });

            const data = result.data as { text: string };
            const cleanText = data.text.replace(/```json|```/g, '').trim();
            onSuggestions(JSON.parse(cleanText));
            
        } catch (e) { 
            console.error("AI Estimation Error:", e);
            alert("Failed to generate AI suggestions. Please try manual entry.");
        } finally { 
            setIsThinking(false); 
        }
    };

    return (
        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800 mb-8 animate-fade-in">
            <h4 className="font-black text-sm uppercase text-indigo-400 mb-3 flex items-center gap-2">
                <BrainCircuit size={16}/> AI Proposal Engine
            </h4>
            <div className="flex flex-col md:flex-row gap-4">
                <Input 
                    placeholder="Describe the problem to generate options..." 
                    value={problemDesc} 
                    onChange={e => setProblemDesc(e.target.value)} 
                    className="flex-1 bg-white dark:bg-slate-900 border-indigo-200 focus:ring-indigo-500 text-slate-900 dark:text-white" 
                />
                <Button onClick={handleAIEstimate} disabled={isThinking} className="bg-indigo-600 text-white hover:bg-indigo-700 h-11 px-6 font-bold shadow-lg">
                    {isThinking ? 'Thinking...' : 'Generate Options'}
                </Button>
            </div>
        </div>
    );
};

export default AIGenerator;
export type { AISuggestion, AISuggestionSet };
