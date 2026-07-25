import { cleanUndefinedFields } from '../lib/utils';
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { db } from 'lib/firebase';
import { uploadFileToStorage } from 'lib/storageService';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Image as ImageIcon, Loader2, Trash2, User, FileSpreadsheet } from 'lucide-react';
import showToast from 'lib/toast';

interface FileUploadQueueItem {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    downloadUrl?: string;
}

const PublicUploadPortal: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [tokenLoading, setTokenLoading] = useState(true);
    const [tokenError, setTokenError] = useState<string | null>(null);
    const [tokenData, setTokenData] = useState<any>(null);
    const [jobData, setJobData] = useState<any>(null);
    const [orgData, setOrgData] = useState<any>(null);

    // Form inputs
    const [uploaderName, setUploaderName] = useState('');
    const [fileQueue, setFileQueue] = useState<FileUploadQueueItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files) {
            const selectedFiles = Array.from(e.dataTransfer.files);
            const newItems: FileUploadQueueItem[] = selectedFiles.map(file => ({
                id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                status: 'pending',
                progress: 0
            }));
            setFileQueue(prev => [...prev, ...newItems]);
        }
    };

    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setTokenError('No security token provided.');
                setTokenLoading(false);
                return;
            }

            try {
                // Fetch magic link
                const tokenDoc = await db.collection('magic_links').doc(token).get();
                
                if (!tokenDoc.exists) {
                    setTokenError('The upload link is invalid or has expired.');
                    setTokenLoading(false);
                    return;
                }

                const data = tokenDoc.data();
                if (!data?.active) {
                    setTokenError('This upload link is no longer active.');
                    setTokenLoading(false);
                    return;
                }

                // Check expiration
                const expiresAt = new Date(data.expiresAt).getTime();
                if (expiresAt < Date.now()) {
                    setTokenError('This upload link has expired.');
                    setTokenLoading(false);
                    return;
                }

                setTokenData(data);
                if (data.uploadedByLabel) {
                    setUploaderName(data.uploadedByLabel);
                }

                // Load Job Data
                if (data.jobId) {
                    const jobDoc = await db.collection('jobs').doc(data.jobId).get();
                    if (jobDoc.exists) {
                        setJobData(jobDoc.data());
                    }
                }

                // Load Organization Data
                if (data.organizationId) {
                    const orgDoc = await db.collection('organizations').doc(data.organizationId).get();
                    if (orgDoc.exists) {
                        setOrgData(orgDoc.data());
                    }
                }

                setTokenLoading(false);
            } catch (err) {
                console.error("Token verification failed:", err);
                setTokenError('Could not verify link security.');
                setTokenLoading(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const selectedFiles = Array.from(e.target.files);

        const newItems: FileUploadQueueItem[] = selectedFiles.map(file => ({
            id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            status: 'pending',
            progress: 0
        }));

        setFileQueue(prev => [...prev, ...newItems]);
        e.target.value = ''; // Reset input
    };

    const handleRemoveFile = (id: string) => {
        setFileQueue(prev => prev.filter(item => item.id !== id));
    };

    const triggerUpload = async () => {
        if (!uploaderName.trim()) {
            showToast.warn('Please enter your name or company.');
            return;
        }

        if (fileQueue.length === 0) {
            showToast.warn('Please select at least one file to upload.');
            return;
        }

        setIsSubmitting(true);

        const uploadedFiles: any[] = [];
        let uploadErrorOccurred = false;

        // Process queue
        for (let i = 0; i < fileQueue.length; i++) {
            const item = fileQueue[i];
            
            // Mark item as uploading
            setFileQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 20 } : q));

            try {
                // Storage file destination path
                const storagePath = `organizations/${tokenData.organizationId}/public_uploads/${tokenData.jobId}/${Date.now()}_${item.file.name}`;
                
                // Upload file to storage
                const downloadUrl = await uploadFileToStorage(storagePath, item.file);

                setFileQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', progress: 100, downloadUrl } : q));

                // Create the files payload object matching the database schema
                const newFilePayload = {
                    id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    organizationId: tokenData.organizationId,
                    parentId: tokenData.jobId,
                    parentType: 'job',
                    fileName: item.file.name,
                    fileType: item.file.type,
                    dataUrl: downloadUrl,
                    createdAt: new Date().toISOString(),
                    uploadedBy: `${uploaderName} (Subcontractor Portal)`,
                    label: 'Subcontractor Upload',
                    metadata: {
                        label: 'Subcontractor Upload',
                        uploadedFrom: 'PublicUploadPortal',
                        tokenUsed: token
                    }
                };

                uploadedFiles.push(newFilePayload);
            } catch (err) {
                console.error(`Failed uploading file ${item.file.name}:`, err);
                setFileQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', progress: 0 } : q));
                uploadErrorOccurred = true;
            }
        }

        if (uploadedFiles.length > 0) {
            try {
                // Write directly to the target job
                await db.collection('jobs').doc(tokenData.jobId).update(cleanUndefinedFields({
                    files: firebase.firestore.FieldValue.arrayUnion(...uploadedFiles),
                    updatedAt: new Date().toISOString(),
                    tempToken: token // Enforces security rules validation
                }));

                // Increment magic link usage/counter (Optional audit metadata)
                await db.collection('magic_links').doc(token).update(cleanUndefinedFields({
                    lastUploadAt: new Date().toISOString(),
                    uploadedFilesCount: firebase.firestore.FieldValue.increment(uploadedFiles.length)
                })).catch(() => {}); // Non-fatal

                if (!uploadErrorOccurred) {
                    setSubmitSuccess(true);
                    showToast.success('All files uploaded successfully!');
                } else {
                    showToast.warn('Some files uploaded, but others failed.');
                }
            } catch (err) {
                console.error('Failed to link uploaded files to job:', err);
                showToast.error('Upload failed. Connection error.');
            }
        } else {
            showToast.error('No files could be uploaded.');
        }

        setIsSubmitting(false);
    };

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-500" />;
        if (type.includes('pdf')) return <FileText className="w-5 h-5 text-rose-500" />;
        if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
        return <FileText className="w-5 h-5 text-slate-400" />;
    };

    if (tokenLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                <p className="text-slate-400 font-medium">Securing connection...</p>
            </div>
        );
    }

    if (tokenError) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/50 backdrop-blur-xl p-8 text-center rounded-3xl shadow-2xl">
                    <div className="w-16 h-16 bg-rose-500/10 rounded-full flex mx-auto items-center justify-center mb-6">
                        <AlertCircle size={32} className="text-rose-400" />
                    </div>
                    <h1 className="text-xl font-extrabold text-white mb-2">Invalid Link</h1>
                    <p className="text-slate-400 mb-6 leading-relaxed text-sm">{tokenError}</p>
                    <p className="text-xs text-slate-500">Please request a new upload link from your contractor or coordinator.</p>
                </div>
            </div>
        );
    }

    if (submitSuccess) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/50 backdrop-blur-xl p-8 text-center rounded-3xl shadow-2xl">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex mx-auto items-center justify-center mb-6">
                        <CheckCircle2 size={32} className="text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-black text-white mb-2">Upload Complete!</h1>
                    <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                        Your files have been securely transmitted to the coordinator at <strong>{orgData?.name || 'TekTrakker'}</strong>.
                    </p>
                    <div className="bg-slate-900/60 rounded-xl p-4 mb-6 border border-slate-700/30 text-left">
                        <div className="text-xs text-slate-400 uppercase font-semibold mb-2">Transmitted items</div>
                        <ul className="space-y-1">
                            {fileQueue.map((item, idx) => (
                                <li key={idx} className="text-xs text-slate-200 truncate flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                    {item.file.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button
                        onClick={() => {
                            setFileQueue([]);
                            setSubmitSuccess(false);
                        }}
                        className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 cursor-pointer"
                    >
                        Upload More Files
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-955 flex flex-col md:py-10 justify-start items-center p-4 font-sans text-white">
            <div className="max-w-xl w-full bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl">
                {/* Organization Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
                    <div>
                        <div className="text-xs text-indigo-400 font-extrabold uppercase tracking-widest">Subcontractor Upload</div>
                        <h1 className="text-lg font-black tracking-tight">{orgData?.name || 'TekTrakker'}</h1>
                    </div>
                    {orgData?.logoUrl ? (
                        <img src={orgData.logoUrl} alt="Logo" className="h-10 w-auto rounded object-contain" />
                    ) : (
                        <div className="h-10 w-10 bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-lg rounded-xl">
                            {(orgData?.name || 'TT').substring(0, 2).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Job Context Banner */}
                {jobData && (
                    <div className="bg-slate-950/60 border border-slate-800/50 rounded-2xl p-4 mb-6 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Job / Work Order</span>
                            <span className="text-[11px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold">Verified Link</span>
                        </div>
                        <div className="text-sm font-extrabold text-slate-200">
                            {jobData.workOrderNumber ? `WO #${jobData.workOrderNumber}` : 'Active Job File'}
                        </div>
                        {jobData.customerName && (
                            <div className="text-xs text-slate-400">
                                Location: <span className="font-semibold">{jobData.customerName}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Main Form */}
                <div className="space-y-6">
                    {/* Step 1: Identity */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Your Name / Company <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                                <User size={16} />
                            </span>
                            <input
                                type="text"
                                value={uploaderName}
                                onChange={(e) => setUploaderName(e.target.value)}
                                placeholder="e.g. Acme Electric Tech (Dave)"
                                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Step 2: Upload Zone */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Select Documents or Photos <span className="text-rose-500">*</span>
                        </label>
                        
                        <label 
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            className={`flex flex-col items-center justify-center border-2 border-dashed p-8 rounded-2xl cursor-pointer transition-all ${
                                dragActive 
                                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5 scale-[1.01]' 
                                    : 'border-slate-800 hover:border-indigo-500/50 bg-slate-950/40 hover:bg-slate-950/70'
                            }`}
                        >
                            <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${dragActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                            <span className="text-sm font-semibold text-slate-300">Tap or drag files here to select</span>
                            <span className="text-xs text-slate-500 mt-1">Images, PDF, Excel sheets</span>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                multiple
                                accept="image/*,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                className="hidden"
                            />
                        </label>
                    </div>

                    {/* Step 3: Queue List */}
                    {fileQueue.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                                <span>Selected Files ({fileQueue.length})</span>
                                <button 
                                    onClick={() => setFileQueue([])} 
                                    className="text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    Clear all
                                </button>
                            </div>
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {fileQueue.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className="flex items-center justify-between p-3 bg-slate-950 border border-slate-900 rounded-xl"
                                    >
                                        <div className="flex items-center gap-3 truncate min-w-0 pr-4">
                                            {getFileIcon(item.file.type)}
                                            <div className="truncate text-sm font-medium text-slate-300">
                                                {item.file.name}
                                                <div className="text-[10px] text-slate-500 font-semibold">
                                                    {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {item.status === 'uploading' && (
                                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                                            )}
                                            {item.status === 'success' && (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            )}
                                            {item.status === 'error' && (
                                                <AlertCircle className="w-4 h-4 text-rose-500" />
                                            )}
                                            {item.status === 'pending' && (
                                                <button
                                                    onClick={() => handleRemoveFile(item.id)}
                                                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                                                    title="Remove"
                                                    aria-label="Remove File"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Submission Actions */}
                    <div className="pt-2">
                        <button
                            onClick={triggerUpload}
                            disabled={isSubmitting || fileQueue.length === 0 || !uploaderName.trim()}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-800 text-white disabled:text-slate-500 rounded-xl text-sm font-bold transition-all shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-95 disabled:active:scale-100 cursor-pointer flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Uploading files...
                                </>
                            ) : (
                                'Submit Uploads'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicUploadPortal;
