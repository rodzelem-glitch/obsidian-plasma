
import React, { useState, useEffect, useRef } from 'react';
import { Download, ChevronDown, ChevronRight, PenTool, Trash2 } from 'lucide-react';
import type { BidDoc } from 'types';
import Button from 'components/ui/Button';
import Input from 'components/ui/Input';
import Spinner from 'components/ui/Spinner';
import Modal from 'components/ui/Modal';
import SignaturePad, { SignaturePadHandle } from 'components/ui/SignaturePad';

interface GenerateTabProps {
    docs: BidDoc[];
    onGenerate: () => void;
    isGenerating: boolean;
    onGlobalEdit: (prompt: string) => void;
    onEditDoc: (docIndex: number, prompt: string) => void;
    onDownload: (doc: BidDoc) => void;
    onSubmit: () => void;
    hasSubmissionEmail: boolean;
    onSignDoc: (docIndex: number, signatureHtml: string) => void;
    onRemoveSignature?: (docIndex: number) => void;
}

const GenerateTab: React.FC<GenerateTabProps> = ({ docs, onGenerate, isGenerating, onGlobalEdit, onEditDoc, onDownload, onSubmit, hasSubmissionEmail, onSignDoc, onRemoveSignature }) => {
    const [globalEditPrompt, setGlobalEditPrompt] = useState('');
    const [editPrompts, setEditPrompts] = useState<Record<number, string>>({});
    const [openDocIndices, setOpenDocIndices] = useState(new Set<number>());
    
    // Signature state
    const [signDocIndex, setSignDocIndex] = useState<number | null>(null);
    const [printedName, setPrintedName] = useState('');
    const [signerTitle, setSignerTitle] = useState('');
    const sigPadRef = useRef<SignaturePadHandle>(null);

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
    
    const handleSignSubmit = () => {
        if (signDocIndex === null || !sigPadRef.current) return;
        
        if (sigPadRef.current.isEmpty()) {
            alert('Please provide a signature.');
            return;
        }
        
        const signatureDataUrl = sigPadRef.current.toDataURL();
        const currentDate = new Date().toLocaleDateString();
        
        const signatureHtml = `
            <div class="embedded-signature" style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; width: 300px; font-family: sans-serif;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #0f172a;">Signed by:</p>
              <img src="${signatureDataUrl}" style="max-height: 80px; display: block; margin-bottom: 10px;" alt="Signature" />
              <p style="margin: 0 0 4px 0; font-weight: 500; color: #0f172a;">${printedName || 'Authorized Signatory'}</p>
              <p style="margin: 0 0 4px 0; color: #64748b;">${signerTitle || 'Title'}</p>
              <p style="margin: 0; color: #64748b;">Date: ${currentDate}</p>
            </div>
        `;
        
        onSignDoc(signDocIndex, signatureHtml);
        setSignDocIndex(null);
        setPrintedName('');
        setSignerTitle('');
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
                    <div className="flex-shrink-0 flex flex-col gap-3">
                        <Button onClick={onGenerate} disabled={isGenerating} className="h-14 px-10 text-lg bg-gradient-to-r from-purple-600 to-blue-600 shadow-xl flex items-center gap-2">
                            {isGenerating ? <><Spinner /> Generating...</> : 'Generate Documents'}
                        </Button>
                        {docs.length > 0 && hasSubmissionEmail && (
                            <Button onClick={onSubmit} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow">
                                Submit Final Package
                            </Button>
                        )}
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
                    const hasSignature = doc.content.includes('class="embedded-signature"') || doc.content.includes('Signed by:');

                    return (
                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-300">
                            <div 
                                className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50" 
                                onClick={() => toggleDoc(idx)}
                                onKeyDown={(e) => e.key === 'Enter' && toggleDoc(idx)}
                                tabIndex={0}
                                role="button"
                                aria-expanded={isOpen ? 'true' : 'false'}
                            >
                                <h3 className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-3">
                                    {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    {doc.title}
                                </h3>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                                    {hasSignature ? (
                                        <Button variant="outline" size="sm" onClick={() => onRemoveSignature?.(idx)} title="Remove Signature" className="text-red-500 hover:bg-red-50 hover:text-red-600 border-red-200">
                                            <Trash2 size={14} className="mr-1" /> Remove Signature
                                        </Button>
                                    ) : (
                                        <Button variant="secondary" size="sm" onClick={() => setSignDocIndex(idx)} title="Sign Document">
                                            <PenTool size={14} className="mr-1" /> Sign
                                        </Button>
                                    )}
                                    <Button variant="secondary" size="sm" onClick={() => onDownload(doc)} title="Download"><Download size={14} /></Button>
                                </div>
                            </div>
                            {isOpen && (
                                <div className="px-6 pb-6 animate-fade-in" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
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
            
            <Modal isOpen={signDocIndex !== null} onClose={() => setSignDocIndex(null)} title="Sign Document">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500 mb-4">Draw your signature below to embed it into the document.</p>
                    
                    <div className="border border-slate-300 rounded-lg bg-slate-50 overflow-hidden">
                        <SignaturePad 
                            ref={sigPadRef}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label htmlFor="printedName" className="block text-xs font-medium text-slate-700 mb-1">Printed Name</label>
                            <Input id="printedName" value={printedName} onChange={e => setPrintedName(e.target.value)} placeholder="John Doe" />
                        </div>
                        <div>
                            <label htmlFor="signerTitle" className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                            <Input id="signerTitle" value={signerTitle} onChange={e => setSignerTitle(e.target.value)} placeholder="CEO" />
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="secondary" onClick={() => setSignDocIndex(null)}>Cancel</Button>
                        <Button onClick={handleSignSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">Embed Signature</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GenerateTab;
