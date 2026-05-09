import showToast from "lib/toast";

import React, { useState } from 'react';
import Input from 'components/ui/Input';
import Textarea from 'components/ui/Textarea';
import Card from 'components/ui/Card';
import Button from 'components/ui/Button';
import Spinner from 'components/ui/Spinner';
import { Wand2, FileText, ListChecks, Calendar, UploadCloud, Play } from 'lucide-react';
import type { Bid, StoredFile, BidQuestion, BidLineItem } from 'types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { uploadFileToStorage } from 'lib/storageService';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

interface SetupTabProps {
    bid: Bid;
    onUpdate: (updates: Partial<Bid>) => void;
}

const SetupTab: React.FC<SetupTabProps> = ({ bid, onUpdate }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
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

    const processAnalysisResult = (data: { analyses: any[] }, newFiles: StoredFile[] = []) => {
        let combinedRequirements: string[] = [];
        let combinedDeliverables: string[] = [];
        let combinedQuestions: BidQuestion[] = [];
        let combinedLineItems: BidLineItem[] = [];
        let combinedImportantDates: {name: string, date: string}[] = [];
        let combinedSummary = "";
        let finalSolicitationNumber = bid.solicitationNumber;
        let finalAgency = bid.agency;
        let finalDueDate = bid.dueDate;

        data.analyses.forEach((analysis, index) => {
            if (analysis.requirements) combinedRequirements = [...combinedRequirements, ...analysis.requirements];
            if (analysis.deliverables) combinedDeliverables = [...combinedDeliverables, ...analysis.deliverables];
            if (analysis.importantDates) combinedImportantDates = [...combinedImportantDates, ...analysis.importantDates];
            if (analysis.summary) combinedSummary += analysis.summary + "\n\n";
            if (analysis.solicitationNumber && !finalSolicitationNumber) finalSolicitationNumber = analysis.solicitationNumber;
            if (analysis.agency && !finalAgency) finalAgency = analysis.agency;
            if (analysis.dueDate && !finalDueDate) finalDueDate = analysis.dueDate;
            
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

        onUpdate({
            requirements: [...(bid.requirements || []), ...combinedRequirements],
            deliverables: [...(bid.deliverables || []), ...combinedDeliverables],
            importantDates: [...(bid.importantDates || []), ...combinedImportantDates],
            questions: [...(bid.questions || []), ...combinedQuestions],
            lineItems: [...(bid.lineItems || []), ...combinedLineItems],
            summary: bid.summary ? `${bid.summary}\n\n${combinedSummary.trim()}` : combinedSummary.trim(),
            solicitationNumber: finalSolicitationNumber,
            agency: finalAgency,
            dueDate: finalDueDate,
            files: [...(bid.files || []), ...newFiles]
        });
    };

    const handleUploadOnly = async () => {
        if (!selectedFiles || selectedFiles.length === 0) return;
        setIsAnalyzing(true);
        try {
            const uploadedFilesData: StoredFile[] = [];
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const path = `bids/${bid.organizationId}/${bid.id}/${Date.now()}_${file.name}`;
                const downloadUrl = await uploadFileToStorage(path, file);
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
            onUpdate({ files: [...(bid.files || []), ...uploadedFilesData] });
            setSelectedFiles(null);
            const fileInput = document.getElementById('rfp-file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            showToast.success("Files uploaded successfully!");
        } catch (e: any) {
            showToast.error("Failed to upload files.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeSingle = async (file: StoredFile) => {
        setAnalyzingFileId(file.id);
        setIsAnalyzing(true);
        try {
            const filesForAI = [{
                fileData: file.dataUrl,
                mimeType: file.fileType || 'application/pdf',
                fileName: file.fileName
            }];
            const result = await analyzeRFP({ files: filesForAI });
            processAnalysisResult(result.data as { analyses: any[] });
            showToast.success(`Analyzed ${file.fileName} successfully!`);
        } catch (error: any) {
            console.error("Error analyzing file:", error);
            let message = "Failed to analyze document.";
            if (error.message?.includes("exceeds the maximum")) message += " The file is too large for the AI service.";
            showToast.warn(`${message} Details: ${error.message}`);
        } finally {
            setAnalyzingFileId(null);
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeBatch = async () => {
        const samFilesToAnalyze = (bid.files || []).filter(f => f.uploadedBy === 'sam.gov');

        if ((!selectedFiles || selectedFiles.length === 0) && samFilesToAnalyze.length === 0) {
            showToast.warn("Please select at least one file first.");
            return;
        }

        setIsAnalyzing(true);
        try {
            const uploadedFilesData: StoredFile[] = [];
            const filesForAI: { fileData: string, mimeType: string, fileName: string }[] = [];

            if (selectedFiles) {
                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    const isDocx = file.name.endsWith('.docx');
                    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');

                    const path = `bids/${bid.organizationId}/${bid.id}/${Date.now()}_${file.name}`;
                    const downloadUrl = await uploadFileToStorage(path, file);

                    let finalBase64Data = "";
                    let finalMimeType = file.type || 'application/octet-stream';

                    if (isDocx) {
                        const arrayBuffer = await file.arrayBuffer();
                        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                        const extractedText = result.value;
                        if (!extractedText.trim()) throw new Error(`Could not extract text from ${file.name}.`);
                        finalBase64Data = btoa(unescape(encodeURIComponent(extractedText)));
                        finalMimeType = 'text/plain'; 
                    } else if (isXlsx) {
                        const arrayBuffer = await file.arrayBuffer();
                        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                        let extractedText = "";
                        for (const sheetName of workbook.SheetNames) {
                            extractedText += `--- Sheet: ${sheetName} ---\n`;
                            extractedText += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
                            extractedText += `\n\n`;
                        }
                        if (!extractedText.trim()) throw new Error(`Could not extract text from ${file.name}.`);
                        finalBase64Data = btoa(unescape(encodeURIComponent(extractedText)));
                        finalMimeType = 'text/plain'; 
                    } else {
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
            }

            for (const samFile of samFilesToAnalyze) {
                filesForAI.push({
                    fileData: samFile.dataUrl,
                    mimeType: samFile.fileType || 'application/pdf',
                    fileName: samFile.fileName
                });
            }

            const result = await analyzeRFP({ files: filesForAI });
            
            processAnalysisResult(result.data as { analyses: any[] }, uploadedFilesData);
            
            setSelectedFiles(null);
            const fileInput = document.getElementById('rfp-file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            
            showToast.success("RFP(s) Analyzed successfully! Inputs and Pricing tabs have been populated.");
        } catch (error: any) {
            console.error("Error analyzing RFP:", error);
            let message = "Failed to analyze document.";
            if (error.message?.includes("exceeds the maximum")) message += " The files are too large for the AI service. Try analyzing 1 by 1.";
            if (error.code === 'functions/internal') message += " AI service error.";
            showToast.warn(`${message} Details: ${error.message}`);
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload RFP Document(s) (PDF, TXT, DOCX, XLSX)</label>
                            <input 
                                id="rfp-file-upload"
                                title="Upload RFP Documents"
                                type="file" 
                                multiple
                                onChange={handleFileChange} 
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" 
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleAnalyzeBatch} 
                                disabled={isAnalyzing || ((!selectedFiles || selectedFiles.length === 0) && !(bid.files || []).some(f => f.uploadedBy === 'sam.gov'))}
                                className="flex-1 flex items-center justify-center gap-2"
                            >
                                {isAnalyzing && !analyzingFileId ? <Spinner size="sm" /> : <Wand2 size={16} />}
                                {isAnalyzing && !analyzingFileId ? 'Analyzing...' : 'Analyze All'}
                            </Button>
                            <Button 
                                variant="secondary"
                                onClick={handleUploadOnly} 
                                disabled={isAnalyzing || !selectedFiles || selectedFiles.length === 0}
                                className="flex items-center justify-center gap-2 px-3"
                                title="Upload files without analyzing"
                            >
                                <UploadCloud size={16} /> Upload
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic text-center">
                            Note: If analyzing all files fails, upload them first and analyze them 1 by 1 below.
                        </p>
                    </div>
                    
                    {bid.files && bid.files.length > 0 && (
                        <div className="mt-6">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2">Uploaded Documents:</h4>
                            <ul className="space-y-2">
                                {bid.files.map((file: StoredFile) => (
                                    <li key={file.id} className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-gray-500 flex-shrink-0" /> 
                                            <a href={file.dataUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline text-sm truncate">{file.fileName}</a>
                                        </div>
                                        <button 
                                            onClick={() => handleAnalyzeSingle(file)}
                                            disabled={isAnalyzing}
                                            className="self-end text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                                        >
                                            {analyzingFileId === file.id ? <Spinner size="sm" className="text-blue-700" /> : <Play size={10} />}
                                            {analyzingFileId === file.id ? 'Analyzing...' : 'Analyze Single'}
                                        </button>
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
                        {bid.importantDates && bid.importantDates.length > 0 && (
                            <div className="mt-4 p-3 bg-blue-50 dark:bg-slate-800 rounded-lg">
                                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2"><Calendar size={14}/> Important Dates</h4>
                                <ul className="space-y-1">
                                    {bid.importantDates.map((d, i) => (
                                        <li key={i} className="text-xs text-blue-800 dark:text-blue-200 flex justify-between">
                                            <span>{d.name}</span>
                                            <span className="font-medium">{d.date}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
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
