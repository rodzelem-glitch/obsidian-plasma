
import React, { useState } from 'react';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Spinner from 'components/ui/Spinner';
import { Wand2, FileText, ListChecks } from 'lucide-react';
import type { Bid, StoredFile, BidQuestion, BidLineItem } from 'types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { uploadFileToStorage } from 'lib/storageService';
import * as mammoth from 'mammoth';

interface SetupTabProps {
    bid: Bid;
    onUpdate: (updates: Partial<Bid>) => void;
}

const SetupTab: React.FC<SetupTabProps> = ({ bid, onUpdate }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

    const functions = getFunctions();
    const analyzeRFP = httpsCallable(functions, 'analyzeRFP');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFiles(e.target.files);
        } else {
            setSelectedFiles(null);
        }
    };

    const handleAnalyze = async () => {
        if (!selectedFiles || selectedFiles.length === 0) {
            alert("Please select at least one file first.");
            return;
        }

        setIsAnalyzing(true);
        try {
            const uploadedFilesData: StoredFile[] = [];
            const filesForAI: { fileData: string, mimeType: string, fileName: string }[] = [];

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const isDocx = file.name.endsWith('.docx');

                // 1. Upload Original File to Firebase Storage (keep original for records)
                const path = `bids/${bid.organizationId}/${bid.id}/${Date.now()}_${file.name}`;
                const downloadUrl = await uploadFileToStorage(path, file);

                // 2. Prepare Data for AI Analysis
                let finalBase64Data = "";
                let finalMimeType = file.type || 'application/octet-stream';

                if (isDocx) {
                    // PARSE DOCX ON FRONTEND
                    const arrayBuffer = await file.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    const extractedText = result.value;
                    
                    if (!extractedText.trim()) {
                         throw new Error(`Could not extract text from ${file.name}. It may be empty or corrupted.`);
                    }

                    // Convert extracted text to Base64 to send to backend as a text file
                    finalBase64Data = btoa(unescape(encodeURIComponent(extractedText)));
                    finalMimeType = 'text/plain'; 
                } else {
                    // Standard processing for PDF, TXT, etc.
                    finalBase64Data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => {
                            const base64 = (reader.result as string).split(',')[1];
                            resolve(base64);
                        };
                        reader.onerror = reject;
                    });
                }

                filesForAI.push({
                    fileData: finalBase64Data,
                    mimeType: finalMimeType,
                    fileName: file.name
                });

                // 3. Construct File Object for Firestore
                uploadedFilesData.push({
                    id: `file-${Date.now()}-${i}`,
                    organizationId: bid.organizationId,
                    parentId: bid.id,
                    parentType: 'bid',
                    fileName: file.name,
                    fileType: file.type,
                    dataUrl: downloadUrl,
                    createdAt: new Date().toISOString(),
                    uploadedBy: 'user'
                });
            }

            // 4. Call the AI analysis Cloud Function with the array of files
            const result = await analyzeRFP({ files: filesForAI });
            
            const data = result.data as { analyses: any[] };
            
            // 5. Combine results from multiple analyses
            let combinedRequirements: string[] = [];
            let combinedDeliverables: string[] = [];
            let combinedQuestions: BidQuestion[] = [];
            let combinedLineItems: BidLineItem[] = [];
            let combinedSummary = "";
            let finalSolicitationNumber = bid.solicitationNumber;
            let finalAgency = bid.agency;
            let finalDueDate = bid.dueDate;

            data.analyses.forEach((analysis, index) => {
                if (analysis.requirements) combinedRequirements = [...combinedRequirements, ...analysis.requirements];
                if (analysis.deliverables) combinedDeliverables = [...combinedDeliverables, ...analysis.deliverables];
                if (analysis.summary) combinedSummary += analysis.summary + "\n\n";
                if (analysis.solicitationNumber && !finalSolicitationNumber) finalSolicitationNumber = analysis.solicitationNumber;
                if (analysis.agency && !finalAgency) finalAgency = analysis.agency;
                if (analysis.dueDate && !finalDueDate) finalDueDate = analysis.dueDate;
                
                // Add unique IDs to questions and line items to prevent React key collisions
                if (analysis.questions) {
                    const validQuestions = analysis.questions.filter((q: any) => {
                         const text = q.question || q.text;
                         return text && typeof text === 'string' && text.trim().length > 5;
                    });

                    const uniqueQuestions = validQuestions.map((q: any, qi: number) => ({
                        id: `ai-q-${index}-${qi}-${Date.now()}`,
                        question: (q.question || q.text || '').trim(), 
                        answer: q.answer || ''
                    }));
                    combinedQuestions = [...combinedQuestions, ...uniqueQuestions];
                }

                if (analysis.lineItems) {
                     const validItems = analysis.lineItems.filter((item: any) => {
                          return item.description && typeof item.description === 'string' && item.description.trim().length > 2;
                     });

                     const uniqueItems = validItems.map((item: any, ii: number) => ({
                        id: `ai-item-${index}-${ii}-${Date.now()}`,
                        description: item.description.trim(),
                        qty: item.qty || 1,
                        unit: item.unit || 'EA',
                        unitPrice: item.unitPrice || 0,
                        totalPrice: (item.qty || 1) * (item.unitPrice || 0),
                        source: 'AI Extracted'
                    }));
                    combinedLineItems = [...combinedLineItems, ...uniqueItems];
                }
            });

            // 6. Update the bid document in Firestore
            onUpdate({
                requirements: [...(bid.requirements || []), ...combinedRequirements],
                deliverables: [...(bid.deliverables || []), ...combinedDeliverables],
                questions: combinedQuestions, // Replace instead of append to prevent dupes/empties from previous runs
                lineItems: combinedLineItems, // Replace instead of append
                summary: combinedSummary.trim() || bid.summary || '',
                solicitationNumber: finalSolicitationNumber,
                agency: finalAgency,
                dueDate: finalDueDate,
                files: [...(bid.files || []), ...uploadedFilesData]
            });
            
            setSelectedFiles(null);
            const fileInput = document.getElementById('rfp-file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            
            alert("RFP(s) Analyzed successfully! Inputs and Pricing tabs have been populated.");
        } catch (error: any) {
            console.error("Error analyzing RFP:", error);
            let message = "Failed to analyze document.";
            if (error.message?.includes("exceeds the maximum")) message += " The files are too large for the AI service.";
            if (error.code === 'functions/internal') message += " AI service error.";
            alert(`${message} Details: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
                <Card>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={20} /> RFP Document & Analysis</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload RFP Document(s) (PDF, TXT, DOCX)</label>
                            <input 
                                id="rfp-file-upload"
                                title="Upload RFP Documents"
                                type="file" 
                                multiple
                                onChange={handleFileChange} 
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" 
                            />
                        </div>
                        <Button 
                            onClick={handleAnalyze} 
                            disabled={isAnalyzing || !selectedFiles || selectedFiles.length === 0}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            {isAnalyzing ? <Spinner size="sm" /> : <Wand2 size={16} />}
                            {isAnalyzing ? 'Analyzing...' : `Analyze ${selectedFiles ? selectedFiles.length : ''} RFP(s)`}
                        </Button>
                    </div>
                    
                    {bid.files && bid.files.length > 0 && (
                        <div className="mt-6">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Uploaded Documents:</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                {bid.files.map((file: StoredFile) => (
                                    <li key={file.id} className="flex items-center gap-2">
                                        <FileText size={14} className="text-gray-500" /> 
                                        <a href={file.dataUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">{file.fileName}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Card>
                <Card>
                    <h3 className="text-lg font-bold mb-4">Bid Details</h3>
                    <div className="space-y-4">
                        <Input label="Bid Title" value={bid.title} onChange={e => onUpdate({ title: e.target.value })} />
                        <Input label="Solicitation #" value={bid.solicitationNumber || ''} onChange={e => onUpdate({ solicitationNumber: e.target.value })} />
                        <Input label="Agency" value={bid.agency || ''} onChange={e => onUpdate({ agency: e.target.value })} />
                        <div className="flex flex-col">
                            <label className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                            <select 
                                title="Select bid status"
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 border-none rounded-lg focus:ring-2 focus:ring-primary-500"
                                value={bid.status} 
                                onChange={e => onUpdate({ status: e.target.value as any })}
                            >
                                <option value="Draft">Draft</option>
                                <option value="Analyzing">Analyzing</option>
                                <option value="Costing">Costing</option>
                                <option value="Review">Review</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Won">Won</option>
                                <option value="Lost">Lost</option>
                            </select>
                        </div>
                        <Input type="date" label="Due Date" value={bid.dueDate || ''} onChange={e => onUpdate({ dueDate: e.target.value })} />
                    </div>
                </Card>
            </div>

            <div className="md:col-span-2 space-y-6">
                <Card>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ListChecks size={20} /> Extracted Information</h3>
                    
                    {(bid.requirements && bid.requirements.length > 0) ? (
                        <div>
                            <h4 className="font-bold text-md mb-2">Requirements</h4>
                            <ul className="list-disc list-inside space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                {bid.requirements.map((req, i) => <li key={i}>{req}</li>)}
                            </ul>
                        </div>
                    ) : <p className="text-sm text-slate-500">No requirements extracted yet.</p>}

                    <hr className="my-4" />

                    {(bid.deliverables && bid.deliverables.length > 0) ? (
                        <div>
                             <h4 className="font-bold text-md mb-2">Deliverables</h4>
                             <ul className="list-disc list-inside space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                {bid.deliverables.map((del, i) => <li key={i}>{del}</li>)}
                            </ul>
                        </div>
                    ) : <p className="text-sm text-slate-500">No deliverables extracted yet.</p>}

                </Card>
                 <Card>
                    <h3 className="text-lg font-bold mb-4">Summary & Notes</h3>
                    <Textarea label="AI-Generated Summary" value={bid.summary || ''} onChange={e => onUpdate({ summary: e.target.value })} rows={5} />
                    <Textarea label="Internal Notes" value={bid.notes || ''} onChange={e => onUpdate({ notes: e.target.value })} rows={5} className="mt-4" />
                </Card>
            </div>
        </div>
    );
};

export default SetupTab;
