
import React, { useState, useRef } from 'react';
import Modal from 'components/ui/Modal';
import Button from 'components/ui/Button';
import { Camera, AlertTriangle, Zap, Bot, ShieldCheck, X, Upload } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import WebCameraModal from './WebCameraModal';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface VisualQCModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (qcId: string) => void;
    jobId: string;
    organizationId: string;
}

const VisualQCModal: React.FC<VisualQCModalProps> = ({ isOpen, onClose, onComplete, jobId, organizationId }) => {
    const [image, setImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [result, setResult] = useState<{ status: 'pass' | 'fail' | 'warning', comments: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => setImage(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleCameraTrigger = async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                const photo = await CapacitorCamera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: CameraResultType.DataUrl,
                    source: CameraSource.Camera
                });
                if (photo.dataUrl) {
                    setImage(photo.dataUrl);
                }
            } catch (error) {
                console.error("Native camera error:", error);
                // Fallback to web camera if native fails or is cancelled
                setIsCameraOpen(true);
            }
        } else {
            setIsCameraOpen(true);
        }
    };

    const runAIQC = async () => {
        if (!image) return;
        setIsAnalyzing(true);
        try {
            const functions = getFunctions();
            const callGeminiAI = httpsCallable(functions, 'callGeminiAI');
            
            const base64Content = image.split(',')[1];
            
            const prompt = "Act as a quality control inspector for a field service company. Analyze this photo of a completed repair/installation. Check for cleanliness, proper connections, and professional finishing. Respond strictly in JSON format: { \"status\": \"pass\" | \"fail\" | \"warning\", \"comments\": \"string\" }";

            // Using gemini-3.1-pro-image-preview for high-quality vision analysis
            const result = await callGeminiAI({ 
                prompt,
                modelName: "gemini-3.1-pro-image-preview",
                image: {
                    data: base64Content,
                    mimeType: "image/jpeg"
                },
                config: {
                    responseMimeType: "application/json"
                }
            });
            
            const data = result.data as { text: string };
            const text = data.text.replace(/```json|```/g, '').trim();
            setResult(JSON.parse(text));
        } catch (error) {
            console.error("AI QC Error:", error);
            setResult({ status: 'warning', comments: "Visual analysis unavailable. Please review manually." });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSaveResult = async (overrideStatus?: string) => {
        if (!result && !overrideStatus) return;
        setIsSaving(true);
        try {
            const qcRecord = {
                id: `qc-${Date.now()}`,
                status: overrideStatus || result?.status,
                comments: result?.comments || (overrideStatus === 'manual' ? 'Manually overridden by technician.' : ''),
                timestamp: new Date().toISOString(),
                imageUrl: image
            };

            const { db, firebase } = await import('lib/firebase');
            await db.collection('jobs').doc(jobId).update({
                qcAudits: firebase.firestore.FieldValue.arrayUnion(qcRecord),
                updatedAt: new Date().toISOString()
            });

            onComplete(qcRecord.id);
        } catch (error) {
            console.error("Save QC Error:", error);
            alert("Failed to save QC result. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const reset = () => {
        setImage(null);
        setResult(null);
        setIsAnalyzing(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Visual QC Audit">
            <div className="space-y-6">
                {!image ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={handleCameraTrigger}
                                className="h-48 border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all cursor-pointer group bg-white dark:bg-slate-950"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm">
                                    <Camera size={28}/>
                                </div>
                                <div className="text-center">
                                    <p className="font-black text-slate-700 dark:text-slate-300 text-sm uppercase">Take Photo</p>
                                </div>
                            </button>

                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="h-48 border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all cursor-pointer group bg-white dark:bg-slate-950"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-primary-500 group-hover:text-white transition-all shadow-sm">
                                    <Upload size={28}/>
                                </div>
                                <div className="text-center">
                                    <p className="font-black text-slate-700 dark:text-slate-300 text-sm uppercase">Upload</p>
                                </div>
                            </button>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center bg-slate-50 dark:bg-slate-900/50 py-2 rounded-full">
                            AI will audit for compliance & quality
                        </p>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800">
                            <img src={image} className="w-full h-full object-cover" alt="QC Work" />
                            <button 
                                onClick={reset}
                                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 backdrop-blur-md"
                            >
                                <X size={20}/>
                            </button>
                            
                            {isAnalyzing && (
                                <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                                    <div className="relative">
                                        <div className="w-20 h-20 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                                        <Bot className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" size={24}/>
                                    </div>
                                    <p className="mt-4 font-black uppercase tracking-[0.2em] text-sm">Analyzing Quality...</p>
                                </div>
                            )}
                        </div>

                        {!result && !isAnalyzing && (
                            <Button 
                                onClick={runAIQC} 
                                className="w-full h-16 text-lg font-black bg-indigo-600 shadow-xl shadow-indigo-500/20"
                            >
                                <Zap size={20} className="mr-2 fill-current"/> Start AI Work Audit
                            </Button>
                        )}

                        {result && (
                            <div className={`p-6 rounded-3xl border-2 animate-scale-in ${
                                result.status === 'pass' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' : 
                                result.status === 'fail' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 
                                'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30'
                            }`}>
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                                        result.status === 'pass' ? 'bg-emerald-500 text-white' : 
                                        result.status === 'fail' ? 'bg-red-500 text-white' : 
                                        'bg-amber-500 text-white'
                                    }`}>
                                        {result.status === 'pass' ? <ShieldCheck size={24}/> : <AlertTriangle size={24}/>}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black uppercase tracking-widest text-[10px] mb-1 opacity-60">Audit Result</h4>
                                        <p className="font-bold text-slate-900 dark:text-white leading-relaxed">{result.comments}</p>
                                    </div>
                                </div>
                                
                                <div className="mt-6 flex gap-3">
                                    {result.status === 'pass' ? (
                                        <Button onClick={() => handleSaveResult()} disabled={isSaving} className="flex-1 bg-emerald-600 font-black uppercase text-xs tracking-widest">
                                            {isSaving ? 'Saving...' : 'Submit as Passed'}
                                        </Button>
                                    ) : (
                                        <>
                                            <Button variant="secondary" onClick={reset} disabled={isSaving} className="flex-1 font-black uppercase text-xs tracking-widest">Retry Photo</Button>
                                            <Button onClick={() => handleSaveResult('manual')} disabled={isSaving} variant="secondary" className="flex-1 bg-slate-800 text-white border-none font-black uppercase text-xs tracking-widest">
                                                {isSaving ? 'Saving...' : 'Manual Override'}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <WebCameraModal 
                isOpen={isCameraOpen} 
                onClose={() => setIsCameraOpen(false)} 
                onCapture={(dataUrl) => {
                    setImage(dataUrl);
                    setIsCameraOpen(false);
                }} 
            />
        </Modal>
    );
};

export default VisualQCModal;
