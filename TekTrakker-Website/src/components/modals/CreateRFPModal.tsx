import React, { useState, useRef } from 'react';
import { X, Calendar, MapPin, DollarSign, Briefcase, Upload, Cpu, FileText } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppContext } from '../../context/AppContext';
import { uploadFileToStorage } from '../../lib/storageService';
import showToast from 'lib/toast';
import type { RFPNotice } from '../../types';
interface CreateRFPModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (form: Partial<RFPNotice>) => void;
}

const CreateRFPModal: React.FC<CreateRFPModalProps> = ({ isOpen, onClose, onSave }) => {
    const { state } = useAppContext();
    const [form, setForm] = useState<Partial<RFPNotice>>({
        status: 'Open',
        visibility: 'Public',
        requirements: [],
        attachments: []
    });
    
    const [isScanning, setIsScanning] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        setUploading(true);
        try {
            const orgId = state.currentUser?.organizationId || 'demo_org';
            const newAttachments = [...(form.attachments || [])];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const path = `organizations/${orgId}/rfps/${Date.now()}_${file.name}`;
                const url = await uploadFileToStorage(path, file);
                newAttachments.push(url);
            }
            
            setForm({ ...form, attachments: newAttachments });
            showToast.success(`Successfully attached ${files.length} file(s).`);
        } catch (err: any) {
            console.error("Upload Error:", err);
            showToast.warn("Failed to upload files.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAnalyzeRFP = async () => {
        if (!form.attachments || form.attachments.length === 0) {
            showToast.warn("Please upload an RFP document first.");
            return;
        }

        setIsScanning(true);
        showToast.info("Analyzing document with AI...");

        try {
            const functions = getFunctions();
            const analyzeRFPWithAI = httpsCallable(functions, 'analyzeRFPWithAI');
            
            // Note: Since analyzeRFPWithAI currently expects base64 data directly, 
            // and we only have public URLs, we will pass the URLs and let the frontend 
            // fetch them as base64 first.
            const filePromises = form.attachments.map(async (url) => {
                const res = await fetch(url);
                const blob = await res.blob();
                return new Promise<{data: string, mimeType: string}>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve({
                        data: reader.result as string,
                        mimeType: blob.type
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            });

            const files = await Promise.all(filePromises);
            
            const result: any = await analyzeRFPWithAI({ files });
            if (result.data?.success && result.data?.data) {
                const aiData = result.data.data;
                setForm(prev => ({
                    ...prev,
                    title: aiData.title || prev.title,
                    description: aiData.description || prev.description,
                    trade: aiData.trade || prev.trade,
                    location: aiData.location || prev.location,
                    budgetRange: aiData.budgetRange || prev.budgetRange,
                    dueDate: aiData.dueDate || prev.dueDate,
                }));
                showToast.success("AI successfully extracted RFP details!");
            }
        } catch (error: any) {
            console.error("OCR Analysis Failed:", error);
            showToast.warn("AI analysis failed or returned no data.");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm sm:p-6">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create New RFP</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Post a request for proposal to the contractor network.</p>
                    </div>
                    <button
                        onClick={onClose}
                        title="Close"
                        aria-label="Close"
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                    <form id="rfp-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">RFP Title</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                                    placeholder="e.g. Commercial HVAC Installation - Target Store #402"
                                    value={form.title || ''}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description & Scope of Work</label>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                                    placeholder="Describe the project scope, timeline expectations, and any specific deliverables required."
                                    value={form.description || ''}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Required Trades / Components</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['HVAC', 'Plumbing', 'Electrical', 'General Contracting', 'Roofing', 'Landscaping', 'Masonry', 'Carpentry', 'Painting', 'Other'].map(tradeOpt => {
                                            const isSelected = form.trades?.includes(tradeOpt) || form.trade === tradeOpt;
                                            return (
                                                <button
                                                    key={tradeOpt}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentTrades = form.trades || (form.trade ? [form.trade] : []);
                                                        let newTrades;
                                                        if (currentTrades.includes(tradeOpt)) {
                                                            newTrades = currentTrades.filter(t => t !== tradeOpt);
                                                        } else {
                                                            newTrades = [...currentTrades, tradeOpt];
                                                        }
                                                        setForm({
                                                            ...form, 
                                                            trades: newTrades,
                                                            trade: newTrades.length > 0 ? newTrades[0] : '' // legacy fallback
                                                        });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                                                        isSelected 
                                                            ? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800' 
                                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:border-slate-600'
                                                    }`}
                                                >
                                                    {tradeOpt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {(!form.trades || form.trades.length === 0) && !form.trade && (
                                        <p className="text-xs text-red-500 mt-1">Please select at least one trade.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            required
                                            className="w-full pl-10 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                                            placeholder="City, State or Zip"
                                            value={form.location || ''}
                                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Budget Range (Optional)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            className="w-full pl-10 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                                            placeholder="e.g. $10k - $25k"
                                            value={form.budgetRange || ''}
                                            onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="date"
                                            title="Due Date"
                                            required
                                            className="w-full pl-10 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                                            value={form.dueDate || ''}
                                            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Visibility</label>
                                <select
                                    title="Visibility"
                                    aria-label="Visibility"
                                    className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                                    value={form.visibility || 'Public'}
                                    onChange={(e) => setForm({ ...form, visibility: e.target.value as 'Public' | 'Private' })}
                                >
                                    <option value="Public">Public (Visible to all network contractors)</option>
                                    <option value="Private">Private (Visible only via direct invite)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link to Project (Optional)</label>
                                <select
                                    title="Link to Project"
                                    aria-label="Link to Project"
                                    className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-primary-500"
                                    value={form.projectId || ''}
                                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                                >
                                    <option value="">-- No Project (Standalone) --</option>
                                    {state.projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Attachments & AI Extraction</label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()} 
                                            disabled={uploading}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            <Upload size={16} />
                                            {uploading ? 'Uploading...' : 'Upload RFP Document'}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={handleAnalyzeRFP} 
                                            disabled={isScanning || !form.attachments || form.attachments.length === 0}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            <Cpu size={16} className={isScanning ? "animate-pulse" : ""} />
                                            {isScanning ? 'Extracting Data...' : 'Auto-Fill with AI'}
                                        </button>
                                    </div>
                                    <input 
                                        type="file" 
                                        title="File Upload"
                                        aria-label="File Upload"
                                        ref={fileInputRef} 
                                        onChange={handleFileUpload} 
                                        className="hidden" 
                                        multiple 
                                        accept="application/pdf,image/*" 
                                    />
                                    {form.attachments && form.attachments.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            {form.attachments.map((url, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                        <FileText size={16} />
                                                        <a href={url} target="_blank" rel="noreferrer" className="hover:text-primary-600 hover:underline truncate max-w-[200px] sm:max-w-xs">
                                                            Attachment {i + 1}
                                                        </a>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        title="Remove attachment"
                                                        aria-label="Remove attachment"
                                                        onClick={() => {
                                                            const newAtt = [...form.attachments!];
                                                            newAtt.splice(i, 1);
                                                            setForm({ ...form, attachments: newAtt });
                                                        }}
                                                        className="text-red-500 hover:text-red-700 p-1"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="rfp-form"
                        className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <Briefcase size={16} />
                        Post RFP
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateRFPModal;
