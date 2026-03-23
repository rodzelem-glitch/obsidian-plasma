
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Job, EquipmentAsset, StoredFile, InspectionTemplate, Subcontractor } from '../../../types';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { Check, ArrowRight, Sparkles, PlusCircle } from 'lucide-react';
import { db, firebase } from '../../../lib/firebase';
import { useAppContext } from '../../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { compressFile } from '../../../lib/utils';
import InvoiceEditorModal from '../../../components/modals/InvoiceEditorModal';

// Sub-components
import ArrivalStep from './workflow/ArrivalStep';
import DiagnosisStep from './workflow/DiagnosisStep';
import RepairStep from './workflow/RepairStep';
import QualityStep from './workflow/QualityStep';
import BillingStep from './workflow/BillingStep';
import SmartTechAssistant from './SmartTechAssistant';
import LiveAssistModal from './LiveAssistModal';
import WaiverModal from './WaiverModal';
import VisualQCModal from './VisualQCModal';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import BarcodeScannerModal from './BarcodeScannerModal';
import WebCameraModal from './WebCameraModal';
import { globalConfirm } from "lib/globalConfirm";

interface ChecklistItem {
    id: string;
    label: string;
    completed: boolean;
}

interface WorkflowState {
    arrivalNotes: string;
    diagnosisNotes: string;
    workNotes: string;
    completionNotes: string;
    customerFeedback: string;
    diagnosisChecklist: ChecklistItem[];
    qualityChecklist: ChecklistItem[];
    customerDetails: { email: string; phone: string };
    refrigerantLog: any[];
    toolReadings: any[];
}

const JobWorkflowModal: React.FC<{ job: Job, isOpen: boolean, onClose: () => void, onUpdate: (job: Job) => void }> = ({ job, isOpen, onClose, onUpdate }) => {
    const { state, dispatch } = useAppContext();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);

    const [workflowState, setWorkflowState] = useState<WorkflowState>({
        arrivalNotes: '',
        diagnosisNotes: '',
        workNotes: '',
        completionNotes: '',
        customerFeedback: '',
        diagnosisChecklist: [],
        qualityChecklist: [],
        customerDetails: { email: job.customerEmail || '', phone: job.customerPhone || '' },
        refrigerantLog: job.refrigerantLog || [],
        toolReadings: job.toolReadings || []
    });
    
    const [assets, setAssets] = useState<EquipmentAsset[]>([]);
    const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
    const [newAsset, setNewAsset] = useState<Omit<EquipmentAsset, 'id'> & { id?: string }>({ brand: '', model: '', serial: '', type: 'System' });

    const [files, setFiles] = useState<StoredFile[]>(job.files || []);
    const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
    const [payableAmount, setPayableAmount] = useState<number>(0);
    
    // Tool Modals
    const [isLiveAssistOpen, setIsLiveAssistOpen] = useState(false);
    const [isWaiverOpen, setIsWaiverOpen] = useState(false);
    const [isQCOpen, setIsQCOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importTarget, setImportTarget] = useState<'diagnosis' | 'quality'>('diagnosis');
    const [isInvoiceEditorOpen, setIsInvoiceEditorOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isWebCameraOpen, setIsWebCameraOpen] = useState(false);
    const [viewingPhoto, setViewingPhoto] = useState<StoredFile | null>(null);

    // Data Capture Modals
    const [isRefrigerantModalOpen, setIsRefrigerantModalOpen] = useState(false);
    const [isToolReadingModalOpen, setIsToolReadingModalOpen] = useState(false);
    
    const [newReading, setNewReading] = useState({ toolType: '', summary: '' });
    const [refrigerantEntry, setRefrigerantEntry] = useState({ type: 'R-410A', action: 'Added', amount: '', unit: 'oz' });

    const docTemplates = useMemo(() => {
        if (job.assignedPartnerId === state.currentOrganization?.id && job.embeddedData?.inspectionTemplates) {
            return job.embeddedData.inspectionTemplates;
        }
        return state.inspectionTemplates || [];
    }, [state.inspectionTemplates, job, state.currentOrganization]);

    const waiverTemplates = useMemo(() => {
        if (job.assignedPartnerId === state.currentOrganization?.id && job.embeddedData?.waivers) {
            return job.embeddedData.waivers;
        }
        return state.documents.filter(d => d.type === 'Waiver Template');
    }, [state.documents, job, state.currentOrganization]);


    const generateItemsFromIds = (ids: string[], templates: InspectionTemplate[]): ChecklistItem[] => {
        return ids.flatMap(id => {
            const t = templates.find(tpl => tpl.id === id);
            return t ? t.items.map((i, idx) => ({ id: `auto-${t.id}-${idx}-${Date.now()}`, label: i.label, completed: false })) : [];
        });
    };

    useEffect(() => {
        if (isOpen) {
            const customer = state.customers.find(c => c.id === job.customerId);
            setAssets(customer?.equipment || []);

            setWorkflowState(prevState => ({
                ...prevState,
                arrivalNotes: job.notes?.arrival || '',
                diagnosisNotes: job.notes?.diagnosis || '',
                workNotes: job.notes?.work || '',
                completionNotes: job.notes?.completion || '',
                customerFeedback: job.customerFeedback || '',
                diagnosisChecklist: job.notes?.diagnosisChecklist ? JSON.parse(job.notes.diagnosisChecklist) : prevState.diagnosisChecklist,
                qualityChecklist: job.notes?.qualityChecklist ? JSON.parse(job.notes.qualityChecklist) : prevState.qualityChecklist,
                customerDetails: { email: job.customerEmail || '', phone: job.customerPhone || '' },
                refrigerantLog: job.refrigerantLog || [],
                toolReadings: job.toolReadings || []
            }));
            setFiles(job.files || []);
        }
    }, [isOpen, job, state.customers]);

    useEffect(() => {
        if (isOpen) {
            const initialDiagnosisChecklist = generateItemsFromIds(job.requiredDiagnosisChecklistIds || [], docTemplates);
            const initialQualityChecklist = generateItemsFromIds(job.requiredQualityChecklistIds || [], docTemplates);
            
            setWorkflowState(prevState => ({
                ...prevState,
                diagnosisChecklist: job.notes?.diagnosisChecklist ? JSON.parse(job.notes.diagnosisChecklist) : initialDiagnosisChecklist,
                qualityChecklist: job.notes?.qualityChecklist ? JSON.parse(job.notes.qualityChecklist) : initialQualityChecklist,
            }));

            if (job.jobStatus === 'Completed') {
                setStep(5);
            } else if (job.jobStatus === 'In Progress') {
                setStep(3);
            } else {
                setStep(1);
            }
        }
    }, [isOpen, job.id, docTemplates]);

    const updateWorkflowState = <K extends keyof WorkflowState>(key: K, value: WorkflowState[K]) => {
        setWorkflowState(prev => ({ ...prev, [key]: value }));
    };

    const handleJobUpdate = async (updates: Partial<Job & { notes: any }>) => {
        setIsSaving(true);
        try {
            const fullUpdates = { 
                ...updates,
                updatedAt: new Date().toISOString(),
                updatedById: state.currentUser?.id,
                updatedByName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`
            };

            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping Firestore update.", fullUpdates);
                onUpdate({ ...job, ...fullUpdates, notes: { ...job.notes, ...fullUpdates.notes } });
            } else {
                await db.collection('jobs').doc(job.id).update(fullUpdates);
                onUpdate({ ...job, ...fullUpdates, notes: { ...job.notes, ...fullUpdates.notes } });
            }
        } catch (e) {
            console.error("Update failed:", e);
            alert("There was an error saving the job. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };
    
    const saveCurrentState = async () => {
        const updates = {
            notes: {
                arrival: workflowState.arrivalNotes,
                diagnosis: workflowState.diagnosisNotes,
                work: workflowState.workNotes,
                completion: workflowState.completionNotes,
                diagnosisChecklist: JSON.stringify(workflowState.diagnosisChecklist),
                qualityChecklist: JSON.stringify(workflowState.qualityChecklist),
            },
            customerFeedback: workflowState.customerFeedback,
            customerEmail: workflowState.customerDetails.email,
            customerPhone: workflowState.customerDetails.phone,
            refrigerantLog: workflowState.refrigerantLog,
            toolReadings: workflowState.toolReadings,
        };
        await handleJobUpdate(updates);
    };

    const handleStepAdvance = async (nextStep: number) => {
        await saveCurrentState();
        if (nextStep === 3 && job.jobStatus !== 'In Progress') {
            await handleJobUpdate({ jobStatus: 'In Progress' });
        }
        setStep(nextStep);
    };

    const handleAddAsset = async () => {
        if (!newAsset.brand || !newAsset.model) {
            alert("Brand and Model are required.");
            return;
        }
        const assetToAdd = { ...newAsset, id: `asset-${Date.now()}` };
        const customer = state.customers.find(c => c.id === job.customerId);
        if (customer) {
            const updatedEquipment = [...(customer.equipment || []), assetToAdd];
            
            if (state.isDemoMode) {
                 console.log("Demo Mode: Skipping customer update.");
            } else {
                 await db.collection('customers').doc(customer.id).update({ equipment: updatedEquipment });
            }
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: updatedEquipment } });
            setAssets(updatedEquipment);
        }
        setNewAsset({ brand: '', model: '', serial: '', type: 'System' });
        setIsAddAssetOpen(false);
    };

    const openImport = (target: 'diagnosis' | 'quality') => {
        setImportTarget(target);
        setIsImportModalOpen(true);
    };

    const handleLeaveSite = async () => {
        if (!await globalConfirm('Mark job as completed and depart site?')) return;
        await saveCurrentState();
        
        // Lookup Subcontractor. Subcontractors are stored in the job owner's sub collection.
        const subcontractorId = job.assignedPartnerId || job.assignedTechnicianId;
        const subcontractor = state.subcontractors.find(s => s.id === subcontractorId || s.linkedOrgId === subcontractorId);

        if (subcontractor) {
            await handleJobUpdate({ jobStatus: 'Completed', endTime: new Date().toISOString() });
            if (subcontractor.paymentType === 'percentage') {
                const invoiceTotal = job.invoice?.totalAmount || job.invoice?.amount || 0;
                const percentage = subcontractor.paymentPercentage || 0;
                const amount = (invoiceTotal * percentage) / 100;
                await createPayable(subcontractor, amount);
                onClose();
            } else {
                setIsPayableModalOpen(true);
            }
        } else {
            await handleJobUpdate({ jobStatus: 'Completed', endTime: new Date().toISOString() });
            onClose();
        }
    };

    const createPayable = async (subcontractor: Subcontractor, amount: number) => {
        if (!state.currentOrganization) return;
        const payable = {
            id: `payable-${Date.now()}`,
            organizationId: job.organizationId, 
            subcontractorId: subcontractor.id,
            jobId: job.id,
            amount,
            status: 'Unpaid',
            createdAt: new Date().toISOString(),
            companyName: subcontractor.companyName,
            customerName: job.customerName
        };
        await db.collection('payables').doc(payable.id).set(payable);
    };

    const handlePayableModalSubmit = async () => {
        const subcontractorId = job.assignedPartnerId || job.assignedTechnicianId;
        const subcontractor = state.subcontractors.find(s => s.id === subcontractorId || s.linkedOrgId === subcontractorId);
        if (subcontractor) {
            await createPayable(subcontractor, payableAmount);
        }
        setIsPayableModalOpen(false);
        onClose();
    };
    
    const handleAddRefrigerant = () => {
        if (!refrigerantEntry.amount) return;
        const entry = { ...refrigerantEntry, id: `ref-${Date.now()}`, date: new Date().toISOString() };
        updateWorkflowState('refrigerantLog', [...workflowState.refrigerantLog, entry]);
        setRefrigerantEntry({ type: 'R-410A', action: 'Added', amount: '', unit: 'oz' });
        setIsRefrigerantModalOpen(false);
    };

    const handleAddReading = () => {
        if (!newReading.toolType || !newReading.summary) return;
        const reading = { ...newReading, id: `tool-${Date.now()}`, date: new Date().toISOString() };
        updateWorkflowState('toolReadings', [...workflowState.toolReadings, reading]);
        setNewReading({ toolType: '', summary: '' });
        setIsToolReadingModalOpen(false);
    };

    const toggleChecklistItem = (list: keyof WorkflowState, id: string) => {
        const currentList = workflowState[list] as ChecklistItem[];
        const newList = currentList.map(item => 
            item.id === id ? { ...item, completed: !item.completed } : item
        );
        updateWorkflowState(list, newList as any);
    };

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [cameraLabel, setCameraLabel] = useState('Photo');

    const handleNativeCameraTrigger = async (label: string) => {
        setCameraLabel(label);
        console.log("HANDLE_NATIVE_CAMERA_TRIGGERED", label);
        
        try {
            const isNative = (window as any).Capacitor?.isNativePlatform();
            
            if (isNative) {
                const image = await Camera.getPhoto({
                    quality: 60,
                    allowEditing: false,
                    resultType: CameraResultType.DataUrl,
                    source: CameraSource.Camera,
                    saveToGallery: false
                });

                if (image.dataUrl) {
                    const response = await fetch(image.dataUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    processCapturedFile(file, label);
                }
            } else {
                // On Web, show our custom camera modal with live preview
                setIsWebCameraOpen(true);
            }
        } catch (e: any) {
            console.error("Camera error:", e);
            // Fallback to custom camera modal
            setIsWebCameraOpen(true);
        }
    };

    const processCapturedFile = async (file: File, label: string) => {
        setIsSaving(true);
        try {
            const base64 = await compressFile(file, 0.6);
            const newFileId = `file-${Date.now()}`;
            const timestamp = new Date().toISOString();
            const userName = `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Technician';

            const flatFile = {
                id: String(newFileId),
                organizationId: String(job.organizationId),
                parentId: String(job.id),
                parentType: 'job',
                fileName: String(file.name),
                fileType: String(file.type),
                dataUrl: String(base64),
                createdAt: String(timestamp),
                uploadedBy: String(userName),
                label: String(label)
            };

            if (state.isDemoMode) {
                setFiles(prev => [...prev, flatFile as any]);
            } else {
                await db.collection('jobs').doc(job.id).update({
                    files: firebase.firestore.FieldValue.arrayUnion(flatFile),
                    updatedAt: timestamp
                });
                setFiles(prev => [...prev, flatFile as any]);
            }
        } catch (error) {
            console.error("Photo process failed:", error);
            alert("Failed to save photo.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, label: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processCapturedFile(file, label);
    };

    const handleDeletePhoto = async (fileToDelete: StoredFile) => {
        if (!window.confirm("Delete this photo?")) return;
        
        setIsSaving(true);
        try {
            if (state.isDemoMode) {
                setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
            } else {
                // Nuclear delete: Use arrayRemove to ensure it's removed from the array field
                await db.collection('jobs').doc(job.id).update({
                    files: firebase.firestore.FieldValue.arrayRemove(fileToDelete)
                });
                setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
            }
        } catch (e) {
            console.error("Delete failed:", e);
            alert("Failed to delete photo. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleScanResult = (decodedText: string) => {
        console.log("Scanned:", decodedText);
        // Simple search for part in inventory
        const part = state.inventory.find(i => i.barcode === decodedText || i.sku === decodedText);
        if (part) {
            setWorkflowState(prev => ({
                ...prev,
                workNotes: prev.workNotes + `\n[PART ADDED] ${part.name} (SKU: ${part.sku})`
            }));
            alert(`Found Part: ${part.name}. Added to work notes.`);
        } else {
            alert("Part not found in inventory. Manual entry required.");
        }
        setIsScannerOpen(false);
    };

    const handleBuildProposal = async () => {
        await saveCurrentState();
        dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: job.id });
        navigate(`/proposal?jobId=${job.id}&source=workflow`);
        onClose();
    };

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose} title={`Job Workflow: ${job.customerName}`} size="xl">
            <div className="flex flex-col h-[75vh]">
                 <div className="flex justify-between items-center mb-6 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
                    {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => s < step ? setStep(s) : undefined} className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${s < step ? 'bg-green-500 text-white cursor-pointer' : step === s ? 'bg-primary-600 text-white shadow-lg scale-110' : 'bg-slate-300 dark:bg-slate-700 text-slate-500'}`}>
                            {s < step ? <Check size={14}/> : s}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                    <ArrivalStep job={job} custDetails={workflowState.customerDetails} setCustDetails={(val) => updateWorkflowState('customerDetails', val)} arrivalNotes={workflowState.arrivalNotes} setArrivalNotes={(val) => updateWorkflowState('arrivalNotes', val)} assets={assets} setIsAddAssetOpen={setIsAddAssetOpen} saveCustomerInfo={saveCurrentState} hidden={step !== 1} />
                    <DiagnosisStep 
                        setIsWaiverOpen={setIsWaiverOpen} 
                        setIsImportModalOpen={() => openImport('diagnosis')} 
                        setIsToolModalOpen={() => setIsToolReadingModalOpen(true)}
                        buildProposal={handleBuildProposal} 
                        checklists={workflowState.diagnosisChecklist} 
                        toggleChecklistItem={(id) => toggleChecklistItem('diagnosisChecklist', id)} 
                        notes={workflowState.diagnosisNotes} 
                        setNotes={(val) => updateWorkflowState('diagnosisNotes', val)} 
                        handlePhotoUpload={handlePhotoUpload} 
                        takeNativePhoto={() => handleNativeCameraTrigger('Pre-Work')}
                        files={files} 
                        onDeletePhoto={handleDeletePhoto} 
                        onViewPhoto={setViewingPhoto} 
                        hidden={step !== 2} 
                    />
                    <RepairStep 
                        setIsScannerOpen={setIsScannerOpen} 
                        setIsLiveAssistOpen={setIsLiveAssistOpen} 
                        setIsRefrigerantModalOpen={() => setIsRefrigerantModalOpen(true)}
                        workNotes={workflowState.workNotes} 
                        setWorkNotes={(val) => updateWorkflowState('workNotes', val)} 
                        handlePhotoUpload={handlePhotoUpload} 
                        takeNativePhoto={() => handleNativeCameraTrigger('Completed Work')}
                        files={files} 
                        onDeletePhoto={handleDeletePhoto} 
                        onViewPhoto={setViewingPhoto} 
                        hidden={step !== 3} 
                    />
                    <QualityStep setIsQCOpen={setIsQCOpen} setIsImportModalOpen={() => openImport('quality')} checklists={workflowState.qualityChecklist} toggleChecklistItem={(id) => toggleChecklistItem('qualityChecklist', id)} completionNotes={workflowState.completionNotes} setCompletionNotes={(val) => updateWorkflowState('completionNotes', val)} customerFeedback={workflowState.customerFeedback} setCustomerFeedback={(val) => updateWorkflowState('customerFeedback', val)} hidden={step !== 4} />
                    {step === 5 && <BillingStep handleGoToPayments={() => setIsInvoiceEditorOpen(true)} handleLeaveSite={handleLeaveSite} />}
                </div>

                <div className="pt-4 border-t flex justify-between mt-auto">
                    <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={step === 1}>Back</Button>
                    <div className="flex gap-2 ml-auto">
                        <Button variant="ghost" onClick={() => setIsAssistantOpen(true)} className="flex items-center gap-2 text-primary-600"><Sparkles size={16}/> Assistant</Button>
                        {step < 5 ? (
                            <Button onClick={() => handleStepAdvance(step + 1)} className="flex items-center gap-2" disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Next Step'} <ArrowRight size={16}/>
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </Modal>

        <Modal isOpen={isPayableModalOpen} onClose={() => {setIsPayableModalOpen(false); onClose();}} title="Enter Payable Amount">
            <div className="space-y-4">
                <Input 
                    label="Payable Amount"
                    type="number"
                    value={payableAmount}
                    onChange={(e) => setPayableAmount(Number(e.target.value))}
                    required
                />
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={() => {setIsPayableModalOpen(false); onClose();}}>Cancel</Button>
                    <Button onClick={handlePayableModalSubmit}>Save Payable</Button>
                </div>
            </div>
        </Modal>

        <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title={`Import ${importTarget} Checklist`}>
            <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto border rounded divide-y">
                     {docTemplates.map(t => (
                        <button key={t.id} onClick={() => {
                            const items = t.items.map((i: any, idx: number) => ({ id: `imp-${t.id}-${idx}-${Date.now()}`, label: i.label, completed: false }));
                            const listKey = `${importTarget}Checklist` as const;
                            updateWorkflowState(listKey, [...workflowState[listKey], ...items]);
                            setIsImportModalOpen(false);
                        }} className="w-full text-left p-3 hover:bg-slate-50 flex justify-between items-center group">
                            <div><p className="font-bold text-sm">{t.name}</p><p className="text-xs text-slate-400">{t.items.length} items</p></div>
                            <ArrowRight size={16} className="text-slate-300 group-hover:text-primary-500"/>
                        </button>
                    ))}
                </div>
                <Button variant="secondary" onClick={() => setIsImportModalOpen(false)} className="w-full">Cancel</Button>
            </div>
        </Modal>
        
         <Modal isOpen={isAddAssetOpen} onClose={() => setIsAddAssetOpen(false)} title="Add New Asset">
            <div className="space-y-4">
                <Input label="Brand" value={newAsset.brand} onChange={e => setNewAsset({...newAsset, brand: e.target.value})} placeholder="e.g. Trane, Goodman"/>
                <Input label="Model" value={newAsset.model} onChange={e => setNewAsset({...newAsset, model: e.target.value})} placeholder="e.g. XV20i"/>
                <Input label="Serial Number" value={newAsset.serial} onChange={e => setNewAsset({...newAsset, serial: e.target.value})} placeholder="e.g. 12345ABC"/>
                <Select label="Type" value={newAsset.type} onChange={e => setNewAsset({...newAsset, type: e.target.value as any})}>
                    <option>System</option>
                    <option>Unit</option>
                    <option>Part</option>
                </Select>
                 <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={() => setIsAddAssetOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddAsset}><PlusCircle size={16} className="mr-2"/> Add Asset</Button>
                </div>
            </div>
        </Modal>

        {isInvoiceEditorOpen && <InvoiceEditorModal isOpen={true} onClose={() => setIsInvoiceEditorOpen(false)} jobId={job.id} />}
        <LiveAssistModal isOpen={isLiveAssistOpen} onClose={() => setIsLiveAssistOpen(false)} job={job} />
        <WaiverModal isOpen={isWaiverOpen} onClose={() => setIsWaiverOpen(false)} onSign={(sig) => {}} job={job} />
        <VisualQCModal isOpen={isQCOpen} onClose={() => setIsQCOpen(false)} onComplete={() => setIsQCOpen(false)} />
        <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScanResult} />
        <WebCameraModal isOpen={isWebCameraOpen} onClose={() => setIsWebCameraOpen(false)} onCapture={(dataUrl) => {
             fetch(dataUrl).then(r => r.blob()).then(blob => {
                 const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
                 processCapturedFile(file, cameraLabel);
             });
        }} />
        
        {viewingPhoto && (
            <Modal isOpen={true} onClose={() => setViewingPhoto(null)} title={viewingPhoto.fileName}>
                <div className="flex flex-col items-center gap-4">
                    <img src={viewingPhoto.dataUrl || (viewingPhoto as any).url} className="w-full rounded-lg shadow-xl" alt="Full size view" />
                    <Button variant="secondary" onClick={() => setViewingPhoto(null)} className="w-full">Close Preview</Button>
                </div>
            </Modal>
        )}

        <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={cameraInputRef} 
            onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processCapturedFile(file, cameraLabel);
            }}
            className="hidden" 
        />
        <SmartTechAssistant isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} jobId={job.id} organizationId={job.organizationId} />
        </>
    );
};

export default JobWorkflowModal;
