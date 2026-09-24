import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Sparkles, Loader2, RefreshCw, Save, Plus, ArrowRight, Eye } from 'lucide-react';
import type { Job, Customer } from '../../types';
import { parsePaperTechForm, ExtractedPaperFormData } from '../../utils/paperFormOcr';
import { getFirestore, doc, updateDoc, collection, addDoc } from 'firebase/firestore';

interface UploadPaperFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingJobs?: Job[];
  customers?: Customer[];
  organizationId?: string;
  onJobSaved?: (jobId: string) => void;
}

export const UploadPaperFormModal: React.FC<UploadPaperFormModalProps> = ({
  isOpen,
  onClose,
  existingJobs = [],
  customers = [],
  organizationId = '',
  onJobSaved
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<ExtractedPaperFormData | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>('NEW');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrorMsg(null);
    setSaveSuccess(null);

    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }

    // Process OCR
    setIsProcessing(true);
    try {
      const result = await parsePaperTechForm(selectedFile, existingJobs, customers);
      setExtractedData(result);
      if (result.matchedJob) {
        setSelectedJobId(result.matchedJob.id);
      } else {
        setSelectedJobId('NEW');
      }
    } catch (err: any) {
      console.error("Paper form processing error:", err);
      setErrorMsg("Failed to scan paper form. You can still manually enter job details below.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!extractedData) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const db = getFirestore();

      const toolReadingsPayload = [
        {
          timestamp: new Date().toISOString(),
          source: 'Paper Form OCR Scanner',
          readings: { ...extractedData.readings }
        }
      ];

      const unitStatePayload = [
        {
          assetId: extractedData.equipmentLocation || 'Main Unit',
          health: extractedData.healthStatus || 'Fair',
          diagnosis: extractedData.diagnosisNotes || '',
          repair: extractedData.workNotes || '',
          recommendations: extractedData.recommendations || ''
        }
      ];

      if (selectedJobId === 'NEW') {
        // Create new Job in Firestore
        const newJobRef = await addDoc(collection(db, 'jobs'), {
          organizationId: organizationId || 'default',
          customerName: extractedData.customerName || 'Paper Form Customer',
          customerPhone: extractedData.customerPhone || '',
          customerEmail: extractedData.customerEmail || '',
          address: extractedData.serviceAddress || 'Address on file',
          jobStatus: 'Completed',
          visitType: extractedData.visitType || 'Diagnostic & Repair',
          appointmentTime: extractedData.serviceDate ? `${extractedData.serviceDate}T09:00:00.000Z` : new Date().toISOString(),
          specialInstructions: 'Created via Paper Form OCR Scan',
          notes: {
            diagnosis: extractedData.diagnosisNotes || '',
            workNotes: extractedData.workNotes || '',
            completion: `Paper Form filed. Tech Signature: ${extractedData.hasTechSignature ? 'YES' : 'NO'}, Customer Signature: ${extractedData.hasCustomerSignature ? 'YES' : 'NO'}`
          },
          hvacBrand: extractedData.brand || '',
          techRecommendations: extractedData.recommendations || '',
          unitStates: unitStatePayload,
          partsUsed: extractedData.partsUsed || [],
          toolReadings: toolReadingsPayload,
          createdAt: new Date().toISOString(),
          source: 'Paper Form OCR'
        });

        setSaveSuccess(`New Job #${newJobRef.id.slice(0, 8)} successfully created from paper form!`);
        if (onJobSaved) onJobSaved(newJobRef.id);
      } else {
        // Update existing Job in Firestore
        const jobRef = doc(db, 'jobs', selectedJobId);
        await updateDoc(jobRef, {
          jobStatus: 'Completed',
          hvacBrand: extractedData.brand || undefined,
          techRecommendations: extractedData.recommendations || undefined,
          'notes.diagnosis': extractedData.diagnosisNotes || undefined,
          'notes.workNotes': extractedData.workNotes || undefined,
          'notes.completion': `Paper Form filed. Tech Signature: ${extractedData.hasTechSignature ? 'YES' : 'NO'}, Customer Signature: ${extractedData.hasCustomerSignature ? 'YES' : 'NO'}`,
          unitStates: unitStatePayload,
          partsUsed: extractedData.partsUsed || undefined,
          toolReadings: toolReadingsPayload,
          updatedAt: new Date().toISOString()
        });

        setSaveSuccess(`Job updated successfully from paper form!`);
        if (onJobSaved) onJobSaved(selectedJobId);
      }
    } catch (err: any) {
      console.error("Failed to save job from paper form:", err);
      setErrorMsg("Failed to save to database: " + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-600 text-white rounded-2xl shadow-lg shadow-primary-500/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Upload & Process Paper Tech Form
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Scan physical job sheets filled out by technicians on site
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* UPLOAD / SELECTOR BAR */}
          {!extractedData && !isProcessing && (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-12 text-center bg-slate-50/50 dark:bg-slate-900/20 hover:bg-slate-100/50 transition-all cursor-pointer relative group">
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Drop your scanned paper tech form here, or <span className="text-primary-600 underline">browse</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
                Supports photos (PNG, JPG, HEIC) or scanned PDFs of filled paper work orders.
              </p>
            </div>
          )}

          {/* OCR PROCESSING LOADING */}
          {isProcessing && (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                Scanning Handwritten & Printed Form Data...
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Extracting customer details, equipment health, gauge readings, work findings, and signature verification.
              </p>
            </div>
          )}

          {/* OCR REVIEW INTERFACE */}
          {extractedData && !isProcessing && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: DOCUMENT PREVIEW */}
              <div className="lg:col-span-5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-slate-400" /> Scanned Document
                  </span>
                  <label className="text-xs font-bold text-primary-600 hover:underline cursor-pointer">
                    Change File
                    <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>

                {filePreview ? (
                  <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center min-h-[350px]">
                    <img src={filePreview} alt="Scanned Form" className="max-h-[500px] w-auto object-contain rounded-lg shadow-sm" />
                  </div>
                ) : (
                  <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col justify-center items-center text-center">
                    <FileText className="w-12 h-12 text-slate-400 mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{file?.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{(file?.size || 0) / 1000} KB</p>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: EXTRACTED FORM REVIEW & EDIT */}
              <div className="lg:col-span-7 space-y-5">
                
                {/* MATCH REASON BADGE */}
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                      Target Job Matching
                    </span>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mt-0.5">
                      {extractedData.matchReason} (Confidence: {extractedData.matchConfidence}%)
                    </p>
                  </div>

                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-amber-300 dark:border-amber-800 rounded-xl px-3 py-2 shadow-sm focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="NEW">+ Create New Job from Paper Form</option>
                    {existingJobs.map(job => (
                      <option key={job.id} value={job.id}>
                        Update: #{job.workOrderNumber || job.id.slice(0, 6)} - {job.customerName} ({new Date(job.appointmentTime).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* FORM FIELDS EDIT GRID */}
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  
                  {/* CUSTOMER & WORK ORDER */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Customer & Job Header
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Customer Name</label>
                        <input
                          type="text"
                          value={extractedData.customerName || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, customerName: e.target.value })}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Phone Number</label>
                        <input
                          type="text"
                          value={extractedData.customerPhone || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, customerPhone: e.target.value })}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Service Site Address</label>
                        <input
                          type="text"
                          value={extractedData.serviceAddress || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, serviceAddress: e.target.value })}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* EQUIPMENT & HEALTH */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Equipment & System Health
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Brand</label>
                        <input
                          type="text"
                          value={extractedData.brand || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, brand: e.target.value })}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Model #</label>
                        <input
                          type="text"
                          value={extractedData.model || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, model: e.target.value })}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">System Health</label>
                        <select
                          value={extractedData.healthStatus || 'Fair'}
                          onChange={(e) => setExtractedData({ ...extractedData, healthStatus: e.target.value as any })}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        >
                          <option value="Good">Good</option>
                          <option value="Fair">Fair</option>
                          <option value="Poor">Poor</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* DIAGNOSTIC GAUGE READINGS */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Extracted Gauge & Tool Readings
                    </h4>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">High PSI</label>
                        <input
                          type="text"
                          value={extractedData.readings?.highPressure || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, readings: { ...extractedData.readings, highPressure: e.target.value } })}
                          className="w-full mt-0.5 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Low PSI</label>
                        <input
                          type="text"
                          value={extractedData.readings?.lowPressure || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, readings: { ...extractedData.readings, lowPressure: e.target.value } })}
                          className="w-full mt-0.5 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Superheat</label>
                        <input
                          type="text"
                          value={extractedData.readings?.superheat || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, readings: { ...extractedData.readings, superheat: e.target.value } })}
                          className="w-full mt-0.5 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Subcooling</label>
                        <input
                          type="text"
                          value={extractedData.readings?.subcooling || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, readings: { ...extractedData.readings, subcooling: e.target.value } })}
                          className="w-full mt-0.5 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* DIAGNOSIS & WORK NOTES */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Diagnosis & Work Notes
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Diagnosis / Root Cause</label>
                        <textarea
                          rows={2}
                          value={extractedData.diagnosisNotes || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, diagnosisNotes: e.target.value })}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Work Performed / Repairs Executed</label>
                        <textarea
                          rows={2}
                          value={extractedData.workNotes || ''}
                          onChange={(e) => setExtractedData({ ...extractedData, workNotes: e.target.value })}
                          className="w-full mt-1 p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          {extractedData && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-black shadow-lg shadow-primary-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Job...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> {selectedJobId === 'NEW' ? 'Create New Job from Paper Form' : 'Apply & Save Updates to Job'}
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
