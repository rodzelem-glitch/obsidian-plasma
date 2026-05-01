
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Job, EquipmentAsset, StoredFile, InspectionTemplate, Subcontractor } from '../../../types';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { Check, ArrowRight, Sparkles, PlusCircle, X, Package } from 'lucide-react';
import { db, firebase } from '../../../lib/firebase';
import { uploadFileToStorage } from '../../../lib/storageService';
import { useAppContext } from '../../../context/AppContext';
import Textarea from '../../../components/ui/Textarea';
import { useNavigate } from 'react-router-dom';
import { compressFile } from '../../../lib/utils';
import InvoiceEditorModal from '../../../components/modals/InvoiceEditorModal';
import IndustryToolsHub from '../../tools/IndustryToolsHub';
import Tesseract from 'tesseract.js';

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
import { BarcodeScannerButton } from '../../../components/ui/BarcodeScanner';
import BarcodeScannerModal from './BarcodeScannerModal';
import WebCameraModal from './WebCameraModal';
import { globalConfirm } from "lib/globalConfirm";
import showToast from "lib/toast";

interface ChecklistItem {
    id: string;
    label: string;
    completed: boolean;
    hiddenFromCustomer?: boolean;
}

interface WorkflowState {
    arrivalNotes: string;
    diagnosisNotes: string;
    workNotes: string;
    completionNotes: string;
    customerFeedback: string;
    diagnosisChecklist: ChecklistItem[];
    qualityChecklist: ChecklistItem[];
    membershipOffered?: boolean;
    customerDetails: { email: string; phone: string; address: string };
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
        membershipOffered: false,
        customerDetails: { email: job.customerEmail || '', phone: job.customerPhone || '', address: job.address || '' },
        refrigerantLog: job.refrigerantLog || [],
        toolReadings: job.toolReadings || [],
        partsUsed: (job as any).partsUsed || []
    } as any);
    
    const [assets, setAssets] = useState<EquipmentAsset[]>([]);
    const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
    const [isOcrScanning, setIsOcrScanning] = useState(false);
    const [newAsset, setNewAsset] = useState<Omit<EquipmentAsset, 'id'> & { id?: string; serialPhotoUrl?: string; unitTagPhotoUrl?: string; conditionPhotoUrl?: string }>({ brand: '', model: '', serial: '', type: 'System' });

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
    const [isPartModalOpen, setIsPartModalOpen] = useState(false);
    const [isIndustryToolsOpen, setIsIndustryToolsOpen] = useState(false);
    const [isProposalSelectorOpen, setIsProposalSelectorOpen] = useState(false);
    const [isInvoiceSelectorOpen, setIsInvoiceSelectorOpen] = useState(false);
    
    const [newReading, setNewReading] = useState({ toolType: '', summary: '' });
    const [refrigerantEntry, setRefrigerantEntry] = useState({ type: 'R-410A', action: 'Added', amount: '', unit: 'oz', cylinderNumber: '' });
    const [customCylString, setCustomCylString] = useState('');
    const [partSearch, setPartSearch] = useState('');
    const [selectedPart, setSelectedPart] = useState<any>(null);
    const [partQuantity, setPartQuantity] = useState(1);
    const [partLocation, setPartLocation] = useState('Truck');

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
            return t ? t.items.map((i, idx) => ({ id: `auto-${t.id}-${idx}-${Date.now()}`, label: i.label, completed: false, hiddenFromCustomer: false })) : [];
        });
    };

    useEffect(() => {
        if (isOpen) {
            const customer = state.customers.find(c => c.id === job.customerId);
            setAssets(customer?.equipment || []);

            setWorkflowState((prevState: any) => ({
                ...prevState,
                arrivalNotes: job.notes?.arrival || '',
                diagnosisNotes: job.notes?.diagnosis || '',
                workNotes: job.notes?.work || '',
                completionNotes: job.notes?.completion || '',
                customerFeedback: job.customerFeedback || '',
                diagnosisChecklist: job.notes?.diagnosisChecklist ? JSON.parse(job.notes.diagnosisChecklist) : prevState.diagnosisChecklist,
                qualityChecklist: job.notes?.qualityChecklist ? JSON.parse(job.notes.qualityChecklist) : prevState.qualityChecklist,
                customerDetails: { email: job.customerEmail || '', phone: job.customerPhone || '', address: job.address || '' },
                refrigerantLog: job.refrigerantLog || [],
                toolReadings: job.toolReadings || [],
                partsUsed: (job as any).partsUsed || []
            }));
            setFiles(job.files || []);
        }
    }, [isOpen, job, state.customers]);

    useEffect(() => {
        if (isOpen) {
            const initialDiagnosisChecklist = generateItemsFromIds(job.requiredDiagnosisChecklistIds || [], docTemplates);
            const initialQualityChecklist = generateItemsFromIds(job.requiredQualityChecklistIds || [], docTemplates);
            
            setWorkflowState((prevState: any) => ({
                ...prevState,
                diagnosisChecklist: job.notes?.diagnosisChecklist ? JSON.parse(job.notes.diagnosisChecklist) : initialDiagnosisChecklist,
                qualityChecklist: job.notes?.qualityChecklist ? JSON.parse(job.notes.qualityChecklist) : initialQualityChecklist,
            }));

            const savedStep = sessionStorage.getItem(`workflow_step_${job.id}`);
            if (savedStep) {
                setStep(parseInt(savedStep));
            } else if (job.jobStatus === 'Completed') {
                setStep(5);
            } else if (job.jobStatus === 'In Progress') {
                setStep(3);
            } else {
                setStep(1);
            }
        }
    }, [isOpen, job.id, docTemplates]);

    useEffect(() => {
        if (isOpen) {
            sessionStorage.setItem(`workflow_step_${job.id}`, step.toString());
        }
    }, [step, job.id, isOpen]);

    const updateWorkflowState = <K extends keyof WorkflowState>(key: K, value: WorkflowState[K]) => {
        setWorkflowState(prev => ({ ...prev, [key]: value }));
    };

    const handleJobUpdate = async (updates: Partial<Job & { notes: any, partsUsed: any[] }>) => {
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
                onUpdate({ ...job, ...fullUpdates, notes: { ...job.notes, ...fullUpdates.notes } } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(fullUpdates);
                onUpdate({ ...job, ...fullUpdates, notes: { ...job.notes, ...fullUpdates.notes } } as any);
            }
        } catch (e) {
            console.error("Update failed:", e);
            showToast.error("There was an error saving the job. Please try again.");
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
            address: workflowState.customerDetails.address,
            refrigerantLog: workflowState.refrigerantLog || [],
            toolReadings: workflowState.toolReadings || [],
            partsUsed: (workflowState as any).partsUsed || []
        };
        
        // Ensure customer record is also updated with new potential address
        const customer = state.customers.find(c => c.id === job.customerId);
        if (customer && workflowState.customerDetails.address) {
             const customerUpdates: any = {};
             let doUpdate = false;
             
             if (customer.address !== workflowState.customerDetails.address) {
                 customerUpdates.address = workflowState.customerDetails.address;
                 doUpdate = true;
             }
             
             // Also add as a ServiceLocation if it exists
             if (workflowState.customerDetails.address) {
                 const currentLocations = customer.serviceLocations || [];
                 if (!currentLocations.some((loc: any) => loc.address === workflowState.customerDetails.address)) {
                     currentLocations.push({ id: `loc-${Date.now()}`, name: 'New Location', address: workflowState.customerDetails.address });
                     customerUpdates.serviceLocations = currentLocations;
                     doUpdate = true;
                 }
             }

             if (doUpdate && !state.isDemoMode) {
                 db.collection('customers').doc(customer.id).update(customerUpdates).catch(e => console.error(e));
                 dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, ...customerUpdates } });
             }
        }
        
        await handleJobUpdate(updates as any);
    };

    const handleStepAdvance = async (nextStep: number) => {
        await saveCurrentState();
        if (nextStep === 3 && job.jobStatus !== 'In Progress') {
            await handleJobUpdate({ jobStatus: 'In Progress' });
        }
        setStep(nextStep);
    };

    const handleAssetPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl') => {
        const file = e.target.files?.[0];
        if (!file || !state.currentOrganization) return;
        
        try {
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : `photo-${Date.now()}.png`;
            const path = `organizations/${state.currentOrganization.id}/customers/${job.customerId}/equipment/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            
            const customer = state.customers.find(c => c.id === job.customerId);
            if (customer) {
                const newFileReference: StoredFile = {
                    id: `file-${Date.now()}`,
                    organizationId: customer.organizationId,
                    parentId: customer.id,
                    parentType: 'customer',
                    fileName: `Field Asset Photo - ${safeName}`,
                    dataUrl: downloadUrl,
                    fileType: file.type,
                    createdAt: new Date().toISOString(),
                    uploadedBy: state.currentUser?.id || 'unknown',
                };
                const updatedFiles = [...(customer.files || []), newFileReference];
                if (!state.isDemoMode) {
                    await db.collection('customers').doc(customer.id).update({ files: updatedFiles });
                }
                dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, files: updatedFiles } });
            }
            
            let extractedSerial = newAsset.serial;
            let extractedModel = newAsset.model;

            if (photoType === 'serialPhotoUrl' || photoType === 'unitTagPhotoUrl') {
                setIsOcrScanning(true);
                try {
                    const result = await Tesseract.recognize(file, 'eng');
                    const text = result.data.text.toUpperCase();
                    
                    const serialMatch = text.match(/(?:S\/?N|SERIAL(?:\s*NO|\s*NUM(?:BER)?)?)\s*[:#\-]?\s*([A-Z0-9]+)/i);
                    const modelMatch = text.match(/(?:M\/?N|MOD(?:EL)?(?:\s*NO|\s*NUM(?:BER)?)?)\s*[:#\-]?\s*([A-Z0-9\-]+)/i);

                    if (serialMatch && serialMatch[1]) {
                        extractedSerial = serialMatch[1].toUpperCase();
                    }
                    if (modelMatch && modelMatch[1]) {
                        extractedModel = modelMatch[1].toUpperCase();
                    }
                    
                    if (!extractedSerial && !extractedModel) {
                         console.log("OCR couldn't confidently find a label with SN or MODEL in standard format.");
                         showToast.warn("Couldn't read serial/model from image. It might be blurry or formatted unusually.");
                    }
                } catch (ocrErr) {
                    console.error("OCR Failed:", ocrErr);
                } finally {
                    setIsOcrScanning(false);
                }
            }

            setNewAsset(prev => ({ 
                ...prev, 
                [photoType]: downloadUrl,
                serial: extractedSerial || prev.serial,
                model: extractedModel || prev.model
            }));

        } catch (err) {
            console.error(err);
            showToast.error("Upload failed.");
        }
    };

    const handleAddAsset = async () => {
        if (!newAsset.brand || !newAsset.model) {
            showToast.warn("Brand and Model are required.");
            return;
        }
        const customer = state.customers.find(c => c.id === job.customerId);
        if (customer) {
            let updatedEquipment;
            if (newAsset.id) {
                updatedEquipment = (customer.equipment || []).map(e => e.id === newAsset.id ? newAsset as EquipmentAsset : e);
            } else {
                const assetToAdd = { ...newAsset, id: `asset-${Date.now()}` } as EquipmentAsset;
                updatedEquipment = [...(customer.equipment || []), assetToAdd];
            }
            
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
        const missingItems: string[] = [];
        
        // Step 1 check
        if (!workflowState.arrivalNotes?.trim()) missingItems.push('Arrival Notes');
        if (!assets || assets.length === 0) missingItems.push('Serviced Equipment / Assets');

        // Step 2 check
        if (!workflowState.diagnosisNotes?.trim()) missingItems.push('Diagnosis Notes');
        if (workflowState.diagnosisChecklist?.length > 0 && workflowState.diagnosisChecklist.some(i => !i.completed)) missingItems.push('Diagnosis Checklist Items');
        if (!workflowState.toolReadings || workflowState.toolReadings.length === 0) missingItems.push('Diagnostic Tool Readings');
        if (!files || files.length === 0) missingItems.push('Job Photos');
        if (!state.proposals?.some(p => p.jobId === job.id)) missingItems.push('Linked Proposals');

        // Step 3 check
        if (!workflowState.workNotes?.trim()) missingItems.push('Work Notes');
        if (!(workflowState as any).partsUsed || (workflowState as any).partsUsed.length === 0) missingItems.push('Parts & Materials Log');

        // Step 4 check
        if (workflowState.qualityChecklist?.length > 0 && workflowState.qualityChecklist.some(i => !i.completed)) missingItems.push('Quality QC Checklist Items');
        if (!workflowState.completionNotes?.trim()) missingItems.push('Completion Notes');

        if (missingItems.length > 0) {
            const msg = `Are you sure you meant to skip these?\n\n- ${missingItems.join('\n- ')}`;
            if (!await globalConfirm(msg, 'Incomplete Job Workflow', 'Close Job', 'Go Back')) return;
        } else {
            if (!await globalConfirm('Mark job as completed and depart site?', 'Complete Job', 'Confirm', 'Cancel')) return;
        }

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
    
    const handleAddRefrigerant = async () => {
        if (!refrigerantEntry.amount) return;
        
        let cylinderName = refrigerantEntry.cylinderNumber === 'CUSTOM' ? customCylString : refrigerantEntry.cylinderNumber;
        
        // Sync with live refrigerantCylinders if a known cylinder was selected
        if (refrigerantEntry.cylinderNumber && refrigerantEntry.cylinderNumber !== 'CUSTOM' && !state.isDemoMode) {
            try {
                const cylinder = state.refrigerantCylinders?.find(c => c.id === refrigerantEntry.cylinderNumber);
                if (cylinder) {
                    cylinderName = cylinder.tag || cylinder.type; // Use human readable name for the log entry
                    
                    let amountUsed = Number(refrigerantEntry.amount);
                    if (refrigerantEntry.unit === 'oz') amountUsed = amountUsed / 16;
                    else if (refrigerantEntry.unit === 'kg') amountUsed = amountUsed * 2.20462;
                    
                    // Added means used FROM the cylinder, so we subtract relative to the cylinder stock
                    // Recovered means put INTO the recovery cylinder, so we add relative to the cylinder stock
                    const newQty = refrigerantEntry.action === 'Added' ? (cylinder.remainingWeight - amountUsed) : (cylinder.remainingWeight + amountUsed);
                    
                    await db.collection('refrigerantCylinders').doc(cylinder.id).update({
                        remainingWeight: Math.max(0, newQty) // Disallow negative weights
                    });
                }
            } catch (err) {
                console.error("Failed to sync cylinder inventory", err);
            }
        }
        
        // Modify the tracking entry to embed the resolved name but keep the ID safe if needed
        const entry = { 
            ...refrigerantEntry, 
            cylinderNumber: cylinderName, // Log the human readable cylinder
            cylinderId: refrigerantEntry.cylinderNumber !== 'CUSTOM' ? refrigerantEntry.cylinderNumber : undefined,
            id: `ref-${Date.now()}`, 
            date: new Date().toISOString() 
        };
        
        updateWorkflowState('refrigerantLog', [...workflowState.refrigerantLog, entry]);
        setRefrigerantEntry({ type: 'R-410A', action: 'Added', amount: '', unit: 'lbs', cylinderNumber: '' });
        setIsRefrigerantModalOpen(false);
    };

    const [partPaymentMethod, setPartPaymentMethod] = useState<'inventory' | 'company' | 'personal' | 'other'>('inventory');
    const [partReceipt, setPartReceipt] = useState<string | null>(null);

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsSaving(true);
        try {
            const orgId = job.organizationId;
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'receipt.jpg';
            const path = `organizations/${orgId}/jobs/${job.id}/parts/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            setPartReceipt(downloadUrl);
        } catch (error) {
            console.error("Receipt process failed:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddPart = async () => {
        if (!selectedPart || partQuantity <= 0) return;
        
        // Ensure SKU is correctly populated for custom items
        const resolvedSku = selectedPart.id === 'custom' ? (selectedPart.sku || 'NEW-PART') : selectedPart.sku;
        // Generate entry payload
        const entry = { 
            id: `p-${Date.now()}`, 
            name: selectedPart.name, 
            sku: resolvedSku, 
            quantity: partQuantity, 
            location: partLocation,
            paymentMethod: partPaymentMethod,
            receiptData: partReceipt,
            approvalStatus: (partPaymentMethod === 'company' || partPaymentMethod === 'personal' || partPaymentMethod === 'other') ? 'pending' : 'approved',
            unitPrice: selectedPart.price || 0,
            total: (selectedPart.price || 0) * partQuantity,
            explanation: (selectedPart as any).explanation || ''
        };

        // If the item is custom (not in existing inventory), auto-provision it into the global inventory pool.
        if (selectedPart.id === 'custom') {
            const newInventoryId = `inv-${Date.now()}`;
            const newInventoryItem = {
                id: newInventoryId,
                organizationId: job.organizationId,
                name: selectedPart.name,
                sku: resolvedSku,
                category: 'Materials',
                price: Number(selectedPart.price || 0),
                cost: Number(selectedPart.price || 0) * 0.5,
                quantity: 0, // In and out simultaneously, net effect on stock is 0
                minQuantity: 5,
                location: 'Truck'
            };
            if (!state.isDemoMode) {
                try {
                    await db.collection('inventory').doc(newInventoryId).set(newInventoryItem);
                    entry.sku = newInventoryId; // Use the DB identifier natively moving forward
                } catch (e) {
                    console.error("Failed to inject new part into global inventory:", e);
                }
            }
        }

        const updatedParts = [...((workflowState as any).partsUsed || []), entry];
        updateWorkflowState('partsUsed' as any, updatedParts as any);
        
        if (partPaymentMethod === 'personal' || partPaymentMethod === 'company' || partPaymentMethod === 'other') {
            try {
                const expense = {
                    id: `exp-${Date.now()}`,
                    organizationId: job.organizationId,
                    userId: state.currentUser?.id,
                    date: new Date().toISOString().split('T')[0],
                    category: 'Materials',
                    vendor: 'Field Purchase',
                    description: `${selectedPart.name} - Job: ${job.customerName}${partPaymentMethod === 'other' ? ' (' + (selectedPart as any).explanation + ')' : ''}`,
                    amount: Number(selectedPart.price || 0) * Number(partQuantity),
                    paidBy: partPaymentMethod === 'personal' ? state.currentUser?.id : (partPaymentMethod === 'company' ? 'Company Account' : 'Other Sourcing'),
                    receiptData: partReceipt,
                    receiptUrl: partReceipt ? 'embedded' : null,
                    projectId: job.id
                };
                if (!state.isDemoMode) await db.collection('expenses').doc(expense.id).set(expense);
            } catch (e) {
                console.error("Expense flow failed:", e);
            }
        } else if (partPaymentMethod === 'inventory' && selectedPart.id !== 'custom') {
            try {
                // Find unassigned expenses that were previously logged for this inventory item
                const linkedExpenses = state.expenses?.filter((e: any) => 
                    e.inventoryItemId === selectedPart.id && !e.projectId
                );
                
                // If we found any unassigned expenses linked to this inventory piece, attach ONE of them to this job string
                if (linkedExpenses && linkedExpenses.length > 0 && !state.isDemoMode) {
                    const expenseToAttach = linkedExpenses[0]; 
                    await db.collection('expenses').doc(expenseToAttach.id).update({
                        projectId: job.id
                    });
                }
            } catch(e) {
                console.error("Failed to link inventory expense to job:", e);
            }
        }
        
        setIsPartModalOpen(false);
        setSelectedPart(null);
        setPartQuantity(1);
        setPartPaymentMethod('inventory');
        setPartReceipt(null);
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

    const toggleChecklistVisibility = (list: keyof WorkflowState, id: string) => {
        const currentList = workflowState[list] as ChecklistItem[];
        const newList = currentList.map(item => 
            item.id === id ? { ...item, hiddenFromCustomer: !item.hiddenFromCustomer } : item
        );
        updateWorkflowState(list, newList as any);
    };

    const toggleAllChecklistVisibility = (list: keyof WorkflowState, hideMode: boolean) => {
        const currentList = workflowState[list] as ChecklistItem[];
        const newList = currentList.map(item => ({ ...item, hiddenFromCustomer: hideMode }));
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
            const orgId = job.organizationId;
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'upload.jpg';
            const path = `organizations/${orgId}/jobs/${job.id}/workflowFiles/${Date.now()}_${safeName}`;
            const downloadUrl = await uploadFileToStorage(path, file);
            const newFileId = `file-${Date.now()}`;
            const timestamp = new Date().toISOString();
            const userName = `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Technician';

            const flatFile = {
                id: String(newFileId),
                organizationId: String(job.organizationId),
                parentId: String(job.id),
                parentType: 'job',
                fileName: String(file.name || 'upload.jpg'),
                fileType: String(file.type || 'image/jpeg'),
                dataUrl: String(downloadUrl),
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
            showToast.error("Failed to save photo.");
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
            showToast.error("Failed to delete photo. Please try again.");
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
            showToast.success(`Found: ${part.name}. Added to work notes.`);
        } else {
            showToast.warn("Part not found in inventory. Manual entry required.");
        }
        setIsScannerOpen(false);
    };

    const handleImportSelectedInvoice = async (invoiceJobId: string) => {
        const sourceJob = state.jobs?.find(j => j.id === invoiceJobId);
        if (sourceJob && sourceJob.invoice) {
            setIsSaving(true);
            try {
                const copiedInvoice = {
                    ...sourceJob.invoice,
                    id: job.invoice?.id || `INV-${Date.now()}`
                };
                await handleJobUpdate({ invoice: copiedInvoice as any });
                setIsInvoiceSelectorOpen(false);
                showToast.success("Invoice successfully imported!");
            } catch (e) {
                console.error("Failed to import invoice", e);
                showToast.error("Failed to import invoice.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleViewEditProposal = async (proposalId: string) => {
        try {
            await db.collection('proposals').doc(proposalId).update({ jobId: job.id });
        } catch (e) { console.error("Warning: Could not formally link proposal to jobId.", e); }

        await saveCurrentState();
        dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: job.id });
        
        const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
        let basePath = isStaff ? '/admin' : '/briefing';
        // Force the app to stay in the technician portal context if they are currently inside it
        if (window.location.hash.includes('/briefing')) {
            basePath = '/briefing';
        }
        
        navigate(`${basePath}/proposal?jobId=${job.id}&source=workflow&proposalId=${proposalId}`);
        onClose();
    };

    const handleBuildProposal = async () => {
        await saveCurrentState();
        dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: job.id });
        
        const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
        let basePath = isStaff ? '/admin' : '/briefing';
        if (window.location.hash.includes('/briefing')) {
            basePath = '/briefing';
        }
        
        navigate(`${basePath}/proposal?jobId=${job.id}&source=workflow`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col md:h-screen w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 safe-top">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} aria-label="Close" title="Close" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-800 dark:text-slate-100">
                        <X size={24}/>
                    </button>
                    <div>
                        <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">{job.customerName}</h2>
                        <p className="text-xs text-slate-500">{job.address}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setIsAssistantOpen(true)} className="hidden md:flex relative !p-2 shrink-0">
                         <Sparkles size={18} className="text-primary-500"/>
                    </Button>
                </div>
            </div>

            <div className="flex justify-center items-center py-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <div className="relative w-full max-w-2xl px-6 md:px-12 mx-auto">
                    <div className="absolute left-10 right-10 top-1/2 h-1 bg-slate-200 dark:bg-slate-700 -translate-y-1/2 rounded-full overflow-hidden">
                        <div className={`h-full bg-green-500 transition-all duration-300 ${['w-0', 'w-1/4', 'w-2/4', 'w-3/4', 'w-full'][Math.max(0, Math.min(4, step - 1))] || 'w-0'}`} />
                    </div>
                    <div className="flex justify-between items-center relative z-10 w-full">
                        {[1, 2, 3, 4, 5].map(s => (
                            <div key={s} className="flex flex-col items-center gap-1 group">
                                <button onClick={() => handleStepAdvance(s)} title={['Arrival', 'Diagnosis', 'Repair', 'Quality', 'Billing'][s-1]} className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-xs md:text-sm font-bold transition-all shrink-0 cursor-pointer ${s < step ? 'bg-green-500 text-white shadow-sm hover:bg-green-600' : step === s ? 'bg-primary-600 text-white shadow-lg ring-4 ring-primary-100 dark:ring-primary-900/30' : 'bg-white dark:bg-slate-800 text-slate-400 border-2 border-slate-200 dark:border-slate-700 hover:border-primary-300'}`}>
                                    {s < step ? <Check size={16}/> : s}
                                </button>
                                <span className={`text-[10px] font-bold uppercase tracking-wider hidden md:block pt-1 ${step === s ? 'text-primary-700 dark:text-primary-400' : 'text-slate-400'}`}>
                                    {['Arrive','Diagnose','Repair','Quality','Bill'][s-1]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 md:p-6 custom-scrollbar">
                <ArrivalStep 
                    job={job} 
                    customer={state.customers?.find(c => c.id === job.customerId)}
                    custDetails={workflowState.customerDetails} 
                    setCustDetails={(val) => updateWorkflowState('customerDetails', val)} 
                    arrivalNotes={workflowState.arrivalNotes} 
                    setArrivalNotes={(val) => updateWorkflowState('arrivalNotes', val)} 
                    assets={assets} 
                    isAddAssetOpen={isAddAssetOpen}
                    setIsAddAssetOpen={setIsAddAssetOpen} 
                    newAsset={newAsset}
                    setNewAsset={setNewAsset}
                    handleAddAsset={handleAddAsset}
                    isOcrScanning={isOcrScanning}
                    handleAssetPhotoUpload={handleAssetPhotoUpload}
                    saveCustomerInfo={saveCurrentState} 
                    files={files}
                    handlePhotoUpload={handlePhotoUpload}
                    takeNativePhoto={() => handleNativeCameraTrigger('Pre-Work')}
                    onDeletePhoto={handleDeletePhoto}
                    onViewPhoto={setViewingPhoto}
                    hidden={step !== 1} 
                />
                <DiagnosisStep 
                    setIsWaiverOpen={setIsWaiverOpen} 
                    setIsImportModalOpen={() => openImport('diagnosis')} 
                    setIsToolModalOpen={() => setIsToolReadingModalOpen(true)}
                    buildProposal={handleBuildProposal} 
                    onOpenProposalSelector={() => setIsProposalSelectorOpen(true)}
                    linkedProposals={state.proposals?.filter(p => p.jobId === job.id)}
                    onViewEditProposal={handleViewEditProposal}
                    checklists={workflowState.diagnosisChecklist} 
                    toggleChecklistItem={(id) => toggleChecklistItem('diagnosisChecklist', id)} 
                    toggleChecklistVisibility={(id) => toggleChecklistVisibility('diagnosisChecklist', id)}
                    toggleAllChecklistVisibility={(hideMode) => toggleAllChecklistVisibility('diagnosisChecklist', hideMode)}
                    notes={workflowState.diagnosisNotes} 
                    setNotes={(val) => updateWorkflowState('diagnosisNotes', val)} 
                    handlePhotoUpload={handlePhotoUpload} 
                    takeNativePhoto={() => handleNativeCameraTrigger('Pre-Work')}
                    files={files} 
                    onDeletePhoto={handleDeletePhoto} 
                    onViewPhoto={setViewingPhoto} 
                    toolReadings={workflowState.toolReadings}
                    onDeleteToolReading={(id) => updateWorkflowState('toolReadings', workflowState.toolReadings.filter(r => r.id !== id))}
                    onOpenIndustryTools={() => setIsIndustryToolsOpen(true)}
                    hidden={step !== 2} 
                />
                <RepairStep 
                    setIsScannerOpen={setIsScannerOpen} 
                    setIsLiveAssistOpen={setIsLiveAssistOpen} 
                    setIsRefrigerantModalOpen={() => setIsRefrigerantModalOpen(true)}
                    setIsPartModalOpen={() => setIsPartModalOpen(true)}
                    workNotes={workflowState.workNotes} 
                    setWorkNotes={(val) => updateWorkflowState('workNotes', val)} 
                    handlePhotoUpload={handlePhotoUpload} 
                    takeNativePhoto={() => handleNativeCameraTrigger('Completed Work')}
                    files={files} 
                    onDeletePhoto={handleDeletePhoto} 
                    onViewPhoto={setViewingPhoto} 
                    partsUsed={(workflowState as any).partsUsed || []}
                    onRemovePart={(idx) => {
                        const newList = [...((workflowState as any).partsUsed || [])];
                        newList.splice(idx, 1);
                        updateWorkflowState('partsUsed' as any, newList as any);
                    }}
                    hidden={step !== 3} 
                />
                <QualityStep 
                    setIsQCOpen={setIsQCOpen} 
                    setIsImportModalOpen={() => openImport('quality')} 
                    checklists={workflowState.qualityChecklist} 
                    toggleChecklistItem={(id) => toggleChecklistItem('qualityChecklist', id)} 
                    toggleChecklistVisibility={(id) => toggleChecklistVisibility('qualityChecklist', id)}
                    toggleAllChecklistVisibility={(hideMode) => toggleAllChecklistVisibility('qualityChecklist', hideMode)}
                    completionNotes={workflowState.completionNotes} 
                    setCompletionNotes={(val) => updateWorkflowState('completionNotes', val)} 
                    customerFeedback={workflowState.customerFeedback} 
                    setCustomerFeedback={(val) => updateWorkflowState('customerFeedback', val)} 
                    membershipOffered={workflowState.membershipOffered || false} 
                    setMembershipOffered={(val) => updateWorkflowState('membershipOffered', val)} 
                    hidden={step !== 4} 
                />
                {step === 5 && <BillingStep handleGoToPayments={() => setIsInvoiceEditorOpen(true)} handleLeaveSite={handleLeaveSite} onOpenInvoiceSelector={() => setIsInvoiceSelectorOpen(true)} />}
            </div>

            <div className="w-full shrink-0 z-10 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] safe-bottom">
                <div className="max-w-4xl mx-auto flex justify-between gap-4">
                    <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={step === 1} className="w-1/3 py-3 md:py-4 md:text-lg">Back</Button>
                    {step < 5 ? (
                        <Button onClick={() => handleStepAdvance(step + 1)} disabled={isSaving} className="w-2/3 py-3 md:py-4 md:text-lg font-bold flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white">
                            {isSaving ? 'Saving...' : 'Next'} <ArrowRight size={20}/>
                        </Button>
                    ) : (
                        <Button onClick={handleLeaveSite} disabled={isSaving} className="w-2/3 py-3 md:py-4 md:text-lg font-bold flex items-center justify-center gap-2 !bg-green-600 hover:!bg-green-700 !text-white">
                            {isSaving ? 'Saving...' : 'Complete Job'} <Check size={20}/>
                        </Button>
                    )}
                </div>
            </div>

        </div>

        {/* Proposal Selector Modal */}
        <Modal isOpen={isProposalSelectorOpen} onClose={() => setIsProposalSelectorOpen(false)} title="Select Existing Proposal">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                <p className="text-sm text-slate-500 mb-4">Select an existing proposal for this customer to import into the workflow.</p>
                {(!state.proposals || state.proposals.filter(p => p.jobId === job.id || (job.customerId && p.customerId === job.customerId) || (p.customerName && job.customerName && p.customerName.toLowerCase() === job.customerName.toLowerCase())).length === 0) && (
                    <div className="text-center p-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed">No existing proposals found for this customer.</div>
                )}
                {state.proposals?.filter(p => p.jobId === job.id || (job.customerId && p.customerId === job.customerId) || (p.customerName && job.customerName && p.customerName.toLowerCase() === job.customerName.toLowerCase()))
                    .sort((a,b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime())
                    .map(proposal => (
                    <div key={proposal.id} onClick={() => { setIsProposalSelectorOpen(false); handleViewEditProposal(proposal.id); }} className="border rounded-lg p-4 flex flex-col md:flex-row justify-between md:items-center bg-white cursor-pointer hover:border-purple-400 hover:shadow-md transition-all">
                        <div className="mb-2 md:mb-0">
                            <p className="font-semibold text-slate-900">{proposal.id} - {proposal.customerName}</p>
                            <p className="text-sm text-slate-500">{new Date(proposal.createdAt).toLocaleDateString()} • {proposal.items?.length || 0} items</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-green-700">${(proposal.total || 0).toFixed(2)}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${proposal.status === 'Accepted' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{proposal.status || 'Draft'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </Modal>

        {/* Invoice Selector Modal */}
        <Modal isOpen={isInvoiceSelectorOpen} onClose={() => setIsInvoiceSelectorOpen(false)} title="Select Existing Invoice">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                <p className="text-sm text-slate-500 mb-4">Select an invoice from another job for this customer to import the line items.</p>
                {(!state.jobs || state.jobs.filter(j => j.invoice && (j.customerId === job.customerId || (j.customerName && j.customerName !== 'Unknown Customer' && job.customerName && j.customerName.toLowerCase() === job.customerName.toLowerCase())) && j.id !== job.id).length === 0) && (
                    <div className="text-center p-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed">No other invoices found for this customer.</div>
                )}
                {state.jobs?.filter(j => j.invoice && (j.customerId === job.customerId || (j.customerName && j.customerName !== 'Unknown Customer' && job.customerName && j.customerName.toLowerCase() === job.customerName.toLowerCase())) && j.id !== job.id)
                    .sort((a,b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime())
                    .map(j => (
                    <div key={j.id} onClick={() => { handleImportSelectedInvoice(j.id); }} className="border rounded-lg p-4 flex flex-col md:flex-row justify-between md:items-center bg-white cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
                        <div className="mb-2 md:mb-0">
                            <p className="font-semibold text-slate-900">INV-{j.invoice?.id || j.id} - {j.customerName}</p>
                            <p className="text-sm text-slate-500">{new Date(j.createdAt||0).toLocaleDateString()} • {j.invoice?.items?.length || 0} items</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-green-700">${(Number(j.invoice?.totalAmount || j.invoice?.amount) || 0).toFixed(2)}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${j.invoice?.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>{j.invoice?.status || 'Pending'}</span>
                        </div>
                    </div>
                ))}
            </div>
        </Modal>

        {/* Improved Refrigerant Modal */}
        <Modal isOpen={isRefrigerantModalOpen} onClose={() => setIsRefrigerantModalOpen(false)} title="Log Refrigerant Usage">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Select label="Refrigerant Type" value={refrigerantEntry.type} onChange={e => setRefrigerantEntry({...refrigerantEntry, type: e.target.value})}>
                        <option>R-410A</option>
                        <option>R-22</option>
                        <option>R-404A</option>
                        <option>R-134A</option>
                        <option>R-32</option>
                        <option>R-438A (MO99)</option>
                    </Select>
                    <Select label="Action" value={refrigerantEntry.action} onChange={e => setRefrigerantEntry({...refrigerantEntry, action: e.target.value})}>
                        <option>Added</option>
                        <option>Recovered</option>
                        <option>Reclaimed</option>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Amount" type="number" step="0.1" value={refrigerantEntry.amount} onChange={e => setRefrigerantEntry({...refrigerantEntry, amount: e.target.value})} placeholder="e.g. 2.5"/>
                    <Select label="Unit" value={refrigerantEntry.unit} onChange={e => setRefrigerantEntry({...refrigerantEntry, unit: e.target.value})}>
                        <option>lbs</option>
                        <option>oz</option>
                        <option>kg</option>
                    </Select>
                </div>
                
                <Select label="Select Container/Cylinder" value={refrigerantEntry.cylinderNumber} onChange={e => setRefrigerantEntry({...refrigerantEntry, cylinderNumber: e.target.value})}>
                    <option value="">-- Choose Container --</option>
                    {state.refrigerantCylinders?.map(c => (
                        <option key={c.id} value={c.id}>{c.type} - {c.tag} ({c.status}) [{c.remainingWeight.toFixed(1)} lbs left]</option>
                    ))}
                    <option value="CUSTOM">Manual Entry...</option>
                </Select>

                {refrigerantEntry.cylinderNumber === 'CUSTOM' && (
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Input label="Manual Cylinder #" placeholder="Enter serial or tracking #" value={customCylString} onChange={e => setCustomCylString(e.target.value)} />
                        </div>
                        <BarcodeScannerButton onScan={(text) => setCustomCylString(text)} />
                    </div>
                )}

                 <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={() => setIsRefrigerantModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddRefrigerant} disabled={!refrigerantEntry.amount || !refrigerantEntry.cylinderNumber}>Log Usage</Button>
                </div>
            </div>
        </Modal>

        {/* Parts Selection Modal */}
        <Modal isOpen={isPartModalOpen} onClose={() => setIsPartModalOpen(false)} title="Add Parts from Inventory">
            <div className="space-y-4">
                {!selectedPart ? (
                    <>
                        <Input 
                            label="Search Inventory" 
                            placeholder="Search by name, SKU or barcode..." 
                            value={partSearch} 
                            onChange={e => setPartSearch(e.target.value)}
                        />
                        <div className="max-h-60 overflow-y-auto border rounded divide-y bg-slate-50 dark:bg-slate-900 shadow-inner">
                            {state.inventory
                                .filter(i => 
                                    i.name.toLowerCase().includes(partSearch.toLowerCase()) || 
                                    i.sku.toLowerCase().includes(partSearch.toLowerCase()) ||
                                    (i.barcode && i.barcode.includes(partSearch))
                                )
                                .slice(0, 50)
                                .map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => setSelectedPart(item)}
                                    className="w-full text-left p-3 hover:bg-primary-50 dark:hover:bg-primary-900/10 flex justify-between items-center group transition-colors"
                                >
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{item.name}</p>
                                        <p className="text-[10px] text-slate-400 uppercase font-black">SKU: {item.sku} • {item.location}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-emerald-600">${item.price}</p>
                                        <p className={`text-[10px] font-bold ${item.quantity <= item.minQuantity ? 'text-red-500' : 'text-slate-500'}`}>Stock: {item.quantity}</p>
                                    </div>
                                </button>
                            ))}
                            {state.inventory.length === 0 && <p className="p-4 text-center text-xs text-slate-400">Inventory is empty.</p>}
                        </div>
                        {partSearch && state.inventory.filter(i => i.name.toLowerCase().includes(partSearch.toLowerCase())).length === 0 && (
                            <div className="p-3 bg-white dark:bg-slate-800 text-center border-t border-slate-200 dark:border-slate-700">
                                <Button variant="secondary" onClick={() => {
                                    setSelectedPart({ id: 'custom', name: partSearch, sku: '', price: 0, quantity: 999, minQuantity: 0, location: 'Manual Entry' });
                                    setPartPaymentMethod('company'); // Default for off-site procurement
                                }} className="w-full text-xs font-bold border-dashed border-2 border-primary-300 dark:border-primary-700">
                                    + Procure "{partSearch}" from Parts House
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-900/20">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-black text-primary-600 uppercase tracking-tight">{selectedPart.name}</h4>
                                <p className="text-xs text-slate-500">Inventory SKU: {selectedPart.sku}</p>
                            </div>
                            <button title="Clear Selection" onClick={() => setSelectedPart(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Quantity Used" type="number" value={partQuantity} onChange={e => setPartQuantity(Number(e.target.value))} min={1} />
                            {selectedPart.id === 'custom' ? (
                                <Input label="Est. Price (Each)" type="number" step="0.01" value={selectedPart.price || ''} onChange={e => setSelectedPart({...selectedPart, price: parseFloat(e.target.value) || 0})} />
                            ) : (
                                <Select label="Pulled From" value={partLocation} onChange={e => setPartLocation(e.target.value)}>
                                    <option>Truck</option>
                                    <option>Warehouse</option>
                                    <option>Job Site</option>
                                </Select>
                            )}
                            {selectedPart.id === 'custom' && (
                                <Input label="Part Number / SKU" value={selectedPart.sku || ''} onChange={e => setSelectedPart({...selectedPart, sku: e.target.value})} placeholder="Optional: Manufacturer part #" className="col-span-2" />
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-primary-100 dark:border-primary-900/20">
                            <Select label="Payment / Sourcing Workflow" value={partPaymentMethod} onChange={e => setPartPaymentMethod(e.target.value as any)}>
                                <option value="inventory">Already in Stock (Inventory)</option>
                                <option value="company">Bought with Company Card (Parts House)</option>
                                <option value="personal">Bought with Personal Funds (Reimburse Me)</option>
                                <option value="other">Other Sourcing Method</option>
                            </Select>

                            {(partPaymentMethod === 'personal' || partPaymentMethod === 'company' || partPaymentMethod === 'other') && (
                                <div className="mt-4 space-y-4">
                                    {partPaymentMethod === 'other' && (
                                        <Textarea 
                                            label="Explanation" 
                                            placeholder="Explain payment method..." 
                                            value={(selectedPart as any).explanation || ''} 
                                            onChange={e => setSelectedPart({...selectedPart, explanation: e.target.value} as any)} 
                                        />
                                    )}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Upload Receipt / Invoice</label>
                                        <div className="flex items-center gap-3">
                                            <input type="file" accept="image/*,application/pdf" onChange={handleReceiptUpload} className="hidden" id="part-receipt" />
                                            <label htmlFor="part-receipt" className={`cursor-pointer px-4 py-2 ${partReceipt ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-white dark:bg-slate-800 border border-slate-300'} rounded shadow-sm text-sm font-medium hover:bg-opacity-80 transition-colors`}>
                                                {partReceipt ? 'Receipt Captured ✓' : 'Take Photo / Upload'}
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 italic">
                                            {partPaymentMethod === 'personal' ? 'Required for fast reimbursement.' : 'Required for review and compliance.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-primary-100 dark:border-primary-900/20 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setSelectedPart(null)} className="w-auto">Change Part</Button>
                            <Button onClick={handleAddPart} className="w-auto">Confirm & Add</Button>
                        </div>
                    </div>
                )}
                 <div className="flex justify-end pt-4">
                    <Button variant="secondary" onClick={() => setIsPartModalOpen(false)} className="w-full">Cancel</Button>
                </div>
            </div>
        </Modal>

        {/* Tool Reading Modal */}
        <Modal isOpen={isToolReadingModalOpen} onClose={() => setIsToolReadingModalOpen(false)} title="Add Tool Reading">
            <div className="space-y-4">
                <Select label="Tool Type" value={newReading.toolType} onChange={e => setNewReading({...newReading, toolType: e.target.value})}>
                    <option value="">-- Select Tool --</option>
                    <option>Sman Digital Manifold</option>
                    <option>JobLink Probes</option>
                    <option>Scale</option>
                    <option>Multimeter</option>
                    <option>Thermal Camera</option>
                    <option>Vacuum Gauge</option>
                </Select>
                <Textarea label="Reading Summary" placeholder="e.g. Low Side: 120 PSI, High Side: 350 PSI, Subcool: 12F" value={newReading.summary} onChange={e => setNewReading({...newReading, summary: e.target.value})} />
                
                <div className="pt-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Attach Reading/Diagnostic Screenshot (Optional)</label>
                    <div className="flex items-center gap-3">
                        <input type="file" accept="image/*,application/pdf" onChange={(e) => handlePhotoUpload(e, 'Diagnostic Reading')} className="hidden" id="reading-upload" />
                        <label htmlFor="reading-upload" className="cursor-pointer px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 rounded shadow-sm text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            Upload Diagnostic File
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={() => setIsToolReadingModalOpen(false)}>Cancel</Button>
                    <Button onClick={() => { handleAddReading(); setIsToolReadingModalOpen(false); }} disabled={!newReading.toolType || !newReading.summary}>Save Reading</Button>
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
        
        {isInvoiceEditorOpen && <InvoiceEditorModal isOpen={true} onClose={() => setIsInvoiceEditorOpen(false)} jobId={job.id} />}
        <LiveAssistModal isOpen={isLiveAssistOpen} onClose={() => setIsLiveAssistOpen(false)} job={job} />
        <WaiverModal isOpen={isWaiverOpen} onClose={() => setIsWaiverOpen(false)} onSign={(sig) => {}} job={job} />
        <VisualQCModal isOpen={isQCOpen} onClose={() => setIsQCOpen(false)} onComplete={() => setIsQCOpen(false)} jobId={job.id} organizationId={job.organizationId} />
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
            title="Camera upload"
            ref={cameraInputRef} 
            onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processCapturedFile(file, cameraLabel);
            }}
            className="hidden" 
        />
        <SmartTechAssistant isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} jobId={job.id} organizationId={job.organizationId} />
        
        {isIndustryToolsOpen && (
            <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto">
                <div className="min-h-screen p-4 flex items-center justify-center">
                     <div className="relative w-full max-w-6xl bg-slate-50 dark:bg-slate-950 rounded-3xl overflow-hidden shadow-2xl">
                         <button aria-label="Close" title="Close" onClick={() => setIsIndustryToolsOpen(false)} className="absolute top-4 right-4 z-10 bg-slate-200 p-2 rounded-full"><X size={20}/></button>
                         <div className="h-[80vh] overflow-y-auto">
                             <IndustryToolsHub />
                         </div>
                     </div>
                </div>
            </div>
        )}
        </>
    );
};

export default JobWorkflowModal;
