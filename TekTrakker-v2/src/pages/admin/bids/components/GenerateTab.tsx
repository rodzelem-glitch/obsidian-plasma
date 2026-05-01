
import React, { useState, useEffect } from 'react';
import { Download, Edit, Bot, ChevronDown, ChevronRight } from 'lucide-react';
import type { BidDoc } from 'types';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Spinner from 'components/ui/Spinner';

interface GenerateTabProps {
    docs: BidDoc[];
    onGenerate: () => void;
    isGenerating: boolean;
    onGlobalEdit: (prompt: string) => void;
    onEditDoc: (docIndex: number, prompt: string) => void;
    onDownload: (doc: BidDoc) => void;
}

const GenerateTab: React.FC<GenerateTabProps> = ({ docs, onGenerate, isGenerating, onGlobalEdit, onEditDoc, onDownload }) => {
    const [globalEditPrompt, setGlobalEditPrompt] = useState('');
    const [editPrompts, setEditPrompts] = useState<Record<number, string>>({});
    const [openDocIndices, setOpenDocIndices] = useState(new Set<number>());

    // Documents will now be collapsed by default.
    useEffect(() => {
        setOpenDocIndices(new Set());
    }, [docs]);

    const sanitizeHtmlContent = (htmlString: string): string => {
        // Extract content from <body> if present, but preserve <style> tags
        const styleMatch = htmlString.match(/<style[\s\S]*?<\/style>/gi);
        const bodyMatch = htmlString.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const content = bodyMatch ? bodyMatch[1] : htmlString;
        const styles = styleMatch ? styleMatch.join('\n') : '';
        return styles + content;
    };

    const toggleDoc = (index: number) => {
        setOpenDocIndices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleGlobalEdit = () => {
        onGlobalEdit(globalEditPrompt);
        setGlobalEditPrompt('');
    };

    const handleDocEdit = (docIndex: number) => {
        onEditDoc(docIndex, editPrompts[docIndex] || '');
        setEditPrompts(prev => ({...prev, [docIndex]: ''}));
    };

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Ready to Generate?</h2>
                        <p className="text-slate-500 mb-4">Click the button to generate all required bid documents based on your inputs.</p>
                         <div className="flex gap-2 max-w-lg mx-auto md:mx-0">
                            <Input 
                                placeholder="Apply a global edit to all docs (e.g., 'change tone to be more formal')" 
                                value={globalEditPrompt}
                                onChange={e => setGlobalEditPrompt(e.target.value)}
                            />
                            <Button variant="secondary" onClick={handleGlobalEdit}>Apply</Button>
                        </div>
                    </div>
                    <div className="w-px bg-slate-200 dark:bg-slate-700 h-20 hidden md:block"></div>
                    <div className="flex-shrink-0">
                        <Button onClick={onGenerate} disabled={isGenerating} className="h-14 px-10 text-lg bg-gradient-to-r from-purple-600 to-blue-600 shadow-xl flex items-center gap-2">
                            {isGenerating ? <><Spinner /> Generating...</> : 'Generate Documents'}
                        </Button>
                    </div>
                </div>
            </div>
            
            {isGenerating && docs.length === 0 && (
                <div className="text-center p-4 md:p-8">
                    <Spinner size="lg" />
                    <p className="mt-4 text-slate-500">Generating initial documents...</p>
                </div>
            )}

            <div className="space-y-4">
                {docs.map((doc, idx) => {
                    const isHistorical = doc.title.toLowerCase().includes('historic') || doc.title.toLowerCase().includes('history');
                    if (isHistorical) return null;

                    const isOpen = openDocIndices.has(idx);
                    return (
                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-300">
                            <div className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50" onClick={() => toggleDoc(idx)}>
                                <h3 className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-3">
                                    {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    {doc.title}
                                </h3>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <Button variant="secondary" size="sm" onClick={() => onDownload(doc)}><Download size={14} /></Button>
                                </div>
                            </div>
                            {isOpen && (
                                <div className="px-6 pb-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                    <div 
                                        className="prose dark:prose-invert max-w-none p-4 border rounded-md bg-slate-50 dark:bg-slate-900/50 mb-4"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(doc.content) }}
                                    />
                                    <div className="flex gap-2 items-center">
                                        <Input 
                                            placeholder="AI Edit... (e.g., 'make this section more concise')" 
                                            value={editPrompts[idx] || ''} 
                                            onChange={e => setEditPrompts(prev => ({...prev, [idx]: e.target.value}))}
                                            className="w-full"
                                        />
                                        <Button onClick={() => handleDocEdit(idx)} size="sm">Apply Edit</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default GenerateTab;
