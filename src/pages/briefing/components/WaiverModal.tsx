import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { db } from '../../../lib/firebase';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import SignatureCanvas from 'react-signature-canvas';
import { StoredFile, Job } from '../../../types';
import { Eye, CheckCircle, FileText, ArrowRight } from 'lucide-react';
import DocumentPreview from '../../../components/ui/DocumentPreview';

const WaiverModal = ({ isOpen, onClose, onSign, job }: { isOpen: boolean, onClose: () => void, onSign: (signature: string) => void, job?: Job }) => {
    const { state, dispatch } = useAppContext();
    const sigCanvas = useRef<any>(null);
    const [step, setStep] = useState(1); // 1: Selection, 2: Preview & Sign
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    const [combinedText, setCombinedText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const waiverTemplates = useMemo(() => {
        // Use embedded waivers if available (for subcontractors), otherwise use global templates
        if (job?.embeddedData?.waivers) {
            return job.embeddedData.waivers;
        }
        return state.documents.filter(d => d.type === 'Waiver Template');
    }, [state.documents, job]);

    useEffect(() => {
        // Auto-select required waivers only when modal opens and we are on step 1
        if (isOpen && job?.requiredWaiverIds && step === 1) {
            const preSelected = job.requiredWaiverIds.filter(id => waiverTemplates.some(t => t.id === id));
            
            // Check if we actually need to update to avoid infinite loops
            const currentSelection = new Set(selectedTemplates);
            const needsUpdate = preSelected.some(id => !currentSelection.has(id));
            
            if (needsUpdate) {
                 setSelectedTemplates(prev => Array.from(new Set([...prev, ...preSelected])));
            }
        }
    }, [isOpen, job?.requiredWaiverIds, waiverTemplates, step]);

    useEffect(() => {
        // Combine text from selected templates
        const text = selectedTemplates.map(id => {
            const template = waiverTemplates.find(t => t.id === id);
            return template ? `<h3>${template.title}</h3>\n${template.content}` : '';
        }).join('<br/><hr/><br/>');
        setCombinedText(text);
    }, [selectedTemplates, waiverTemplates]);

    const handleTemplateToggle = (id: string) => {
        if (selectedTemplates.includes(id)) {
            setSelectedTemplates(selectedTemplates.filter(t => t !== id));
        } else {
            setSelectedTemplates([...selectedTemplates, id]);
        }
    };

    const handleGenerate = () => {
        if (selectedTemplates.length === 0) return;
        setStep(2);
    };

    const handleSave = () => {
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
            const signature = sigCanvas.current.toDataURL();
            
            if (job) {
                const fullHtml = `
                    <html><body>
                        <h1>Waiver Agreement</h1>
                        <p>Job: ${job.customerName} - ${new Date().toLocaleDateString()}</p>
                        <hr/>
                        ${combinedText}
                        <br/><br/>
                        <h3>Signed:</h3>
                        <img src="${signature}" width="300" />
                    </body></html>
                `;
                
                try {
                    const waiverFile: StoredFile = {
                        id: `waiver-doc-${Date.now()}`,
                        organizationId: job.organizationId,
                        parentId: job.id,
                        parentType: 'job',
                        fileName: 'Signed_Waivers.html',
                        fileType: 'text/html',
                        dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(fullHtml))),
                        createdAt: new Date().toISOString(),
                        uploadedBy: state.currentUser?.id || 'tech',
                        metadata: { label: 'Legal Waiver' }
                    };
                    
                    const currentFiles = job.files || [];
                    db.collection('jobs').doc(job.id).update({
                        files: [...currentFiles, waiverFile]
                    }).catch(console.error);
                } catch (e) {
                    console.error("Error creating waiver file:", e);
                    alert("Error saving waiver document. Please try again.");
                    return;
                }
            }

            onSign(signature);
            onClose();
        } else {
            alert("Please sign before accepting.");
        }
    };

    const handleSendToCustomer = async () => {
        if (!job || !job.customerEmail || !combinedText) return;
        setIsSending(true);
        try {
            // Create a pending waiver record so it shows up in the portal
            const pendingWaiver: StoredFile = {
                id: `pending-waiver-${Date.now()}`,
                organizationId: job.organizationId,
                parentId: job.id,
                parentType: 'job',
                fileName: 'Waiver_Pending_Signature.html',
                fileType: 'text/html',
                dataUrl: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(`<html><body>${combinedText}</body></html>`))),
                createdAt: new Date().toISOString(),
                uploadedBy: state.currentUser?.id || 'tech',
                metadata: { 
                    label: 'Legal Waiver',
                    status: 'Pending Signature',
                    isActionRequired: true
                }
            };

            const currentFiles = job.files || [];
            
            const newDoc = {
                id: `doc-${Date.now()}`,
                organizationId: job.organizationId,
                customerId: job.customerId || null,
                customerEmail: job.customerEmail?.toLowerCase() || null,
                jobId: job.id,
                title: 'Legal Waiver (Pending)',
                type: 'Waiver Template',
                content: combinedText,
                createdAt: new Date().toISOString(),
                createdBy: state.currentUser?.id || 'tech',
                url: pendingWaiver.dataUrl,
                status: 'Pending Signature'
            };

            if (state.isDemoMode) {
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, files: [...currentFiles, pendingWaiver] } });
                dispatch({ type: 'ADD_DOCUMENT', payload: newDoc as any });
            } else {
                await db.collection('jobs').doc(job.id).update({
                    files: [...currentFiles, pendingWaiver]
                });
                // Also add as a BusinessDocument for centralized tracking
                await db.collection('documents').add(newDoc);
            }

            await db.collection('mail').add({
                to: [job.customerEmail],
                message: {
                    subject: `Action Required: Waivers for ${job.customerName}`,
                    html: `
                        <div style="font-family: sans-serif;">
                            <h2>Waiver Review & Signature Request</h2>
                            <p>Please review and sign the required waivers for your service appointment.</p>
                            <div style="background: #f4f7f6; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                                ${combinedText}
                            </div>
                            <p>You can sign these electronically by logging into your customer portal.</p>
                            <a href="https://tektrakker.com/portal" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Go to Customer Portal</a>
                        </div>
                    `
                },
                organizationId: job.organizationId,
                type: 'WaiverRequest',
                createdAt: new Date().toISOString()
            });
            alert("Sent to customer and added to pending documents!");
        } catch (e) {
            console.error(e);
            alert("Failed to send.");
        } finally {
            setIsSending(false);
        }
    };

    const handleClear = () => {
        sigCanvas.current?.clear();
    };

    const getPreviewData = () => ({
        type: 'Waiver Agreement',
        htmlContent: combinedText,
        title: 'Waiver Agreement'
    });

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={step === 1 ? "Select Required Waivers" : "Review & Sign Agreement"} size="lg">
                <div className="space-y-6">
                    
                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">Select all applicable waivers for this job. They will be combined into a single document for signature.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                                {waiverTemplates.map(t => {
                                    const isSelected = selectedTemplates.includes(t.id);
                                    return (
                                        <div 
                                            key={t.id}
                                            onClick={() => handleTemplateToggle(t.id)}
                                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-start gap-3 ${
                                                isSelected 
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                            }`}
                                        >
                                            <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                                                isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white'
                                            }`}>
                                                {isSelected && <CheckCircle size={14} />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{t.title}</h4>
                                                <p className="text-xs text-gray-500 line-clamp-2 mt-1" dangerouslySetInnerHTML={{ __html: t.content.substring(0, 100).replace(/<[^>]*>?/gm, '') + '...' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {waiverTemplates.length === 0 && <p className="col-span-2 text-center py-10 text-gray-400 italic">No waiver templates available.</p>}
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button onClick={handleGenerate} disabled={selectedTemplates.length === 0} className="flex items-center gap-2">
                                    Generate Document <ArrowRight size={16} />
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white">Waiver Agreement Generated</h4>
                                    <p className="text-xs text-gray-500">{selectedTemplates.length} sections included.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" onClick={() => setIsPreviewOpen(true)} className="text-xs flex items-center gap-2">
                                        <Eye size={14}/> View Full Document
                                    </Button>
                                    <Button variant="secondary" onClick={() => setStep(1)} className="text-xs">
                                        Edit Selection
                                    </Button>
                                </div>
                            </div>

                            <div className="h-40 p-4 border rounded bg-white dark:bg-gray-900 text-xs overflow-y-auto shadow-inner text-gray-500">
                                <p className="italic text-center mt-12">Document ready for signature. Click "View Full Document" to read contents.</p>
                            </div>
                            
                            <div className="border rounded-lg overflow-hidden bg-white relative">
                                <div className="absolute top-2 left-2 text-[10px] font-bold text-gray-400 uppercase pointer-events-none">Customer Signature</div>
                                <SignatureCanvas 
                                    ref={sigCanvas}
                                    penColor='black'
                                    canvasProps={{className: 'w-full h-48 cursor-crosshair'}} 
                                />
                                <button onClick={handleClear} className="absolute bottom-2 right-2 text-xs text-red-500 hover:text-red-700 bg-white/80 px-2 py-1 rounded">Clear</button>
                            </div>
                            
                            <div className="flex justify-between items-center pt-2">
                                <div className="flex gap-2">
                                    {job?.customerEmail && (
                                        <Button 
                                            variant="secondary" 
                                            onClick={handleSendToCustomer} 
                                            disabled={isSending}
                                            className="text-xs"
                                        >
                                            {isSending ? 'Sending...' : 'Send to Customer Review'}
                                        </Button>
                                    )}
                                </div>
                                <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg px-4 md:px-8">
                                    Accept & Sign
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {isPreviewOpen && (
                <DocumentPreview 
                    type="Other" 
                    data={getPreviewData()}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
        </>
    );
};

export default WaiverModal;
