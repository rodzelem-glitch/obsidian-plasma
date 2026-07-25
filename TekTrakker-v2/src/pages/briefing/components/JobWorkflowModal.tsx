/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Job, EquipmentAsset, StoredFile, InspectionTemplate, Subcontractor, Customer } from '../../../types';
import Modal from '../../../components/ui/Modal';
import JobAppointmentModal from '../../../components/modals/JobAppointmentModal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { Check, ArrowRight, Sparkles, X, Clock, MapPin, Navigation, Layers, ImageIcon, Camera as CameraIcon, ChevronDown } from 'lucide-react';
import { EQUIPMENT_OPTIONS } from '@/constants/industryNaming';
import { db, firebase } from '../../../lib/firebase';
import { uploadFileToStorage } from '../../../lib/storageService';
import { cleanUndefinedFields } from '../../../lib/utils';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppContext } from '../../../context/AppContext';
import Textarea from '../../../components/ui/Textarea';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from 'context/LanguageContext';
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
import SignOffModal from './SignOffModal';
import SubcontractorBillModal from './SubcontractorBillModal';
import DocumentPreview from '../../../components/ui/DocumentPreview';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeScannerButton } from '../../../components/ui/BarcodeScanner';
import BarcodeScannerModal from './BarcodeScannerModal';
import WebCameraModal from './WebCameraModal';
import { globalConfirm } from "lib/globalConfirm";
import showToast from "lib/toast";
import { getNextInvoiceNumber } from "lib/numbering";
import { getCurrentLocation } from '../../../lib/geolocation';

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
    techRecommendations: string;
    thankYouNote: string;
    unitStates: Array<{
        assetId: string;
        health: 'Good' | 'Fair' | 'Critical';
        diagnosis?: string;
        repair?: string;
        recommendations?: string;
    }>;
    repairPostponed?: boolean;
    repairPostponedReason?: string;
}

const geocodeAddress = async (address: string | any): Promise<{ lat: number; lng: number } | null> => {
    let addressStr = '';
    if (typeof address === 'string') {
        addressStr = address;
    } else if (address) {
        addressStr = `${address.street || ''}, ${address.city || ''}, ${address.state || ''} ${address.zip || ''}`;
    }
    
    if (!addressStr.trim()) return null;

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressStr)}`,
            {
                headers: {
                    'User-Agent': 'TekTrakker-v2/1.0 (contact@tektrakker.com)'
                }
            }
        );
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (err) {
        console.warn("Geocoding failed, falling back to mock coordinate:", err);
    }
    
    // Stable hash fallback coordinates for demo/testing
    let hash = 0;
    for (let i = 0; i < addressStr.length; i++) {
        hash = addressStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const lat = 29.4241 + (hash % 100) / 1000;
    const lng = -98.4936 + (hash % 100) / 1000;
    return { lat, lng };
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

const getAddressString = (addr: any): string => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    const parts = [
        addr.street,
        addr.city,
        addr.state,
        addr.zip
    ].filter(Boolean);
    return parts.join(', ');
};

const JobWorkflowModal: React.FC<{ 
    job: Job, 
    isOpen: boolean, 
    onClose: () => void, 
    onUpdate: (job: Job) => void,
    initialEditingAssetId?: string | null,
    onClearInitialEditingAsset?: () => void
}> = ({ job, isOpen, onClose, onUpdate, initialEditingAssetId, onClearInitialEditingAsset }) => {
    const { state, dispatch } = useAppContext();
    const industry = state.currentOrganization?.industry || 'HVAC';
    const equipmentOptions = EQUIPMENT_OPTIONS[industry] || EQUIPMENT_OPTIONS['default'] || [];
    const { t } = useLanguage();
    const navigate = useNavigate();
    const isSubcontractor = state.currentUser?.role === 'Subcontractor';
    const assignedUser = state.users?.find(u => u.id === job.assignedTechnicianId);
    const isSubcontractorJob = isSubcontractor || 
        !!job.assignedPartnerId || 
        !!job.subcontractorWorkOrder || 
        assignedUser?.role === 'Subcontractor';
    const [step, setStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [jobSiteCoords, setJobSiteCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [parentJob, setParentJob] = useState<Job | null>(null);

    useEffect(() => {
        const loadParentJob = async () => {
            if (job.parentJobId) {
                try {
                    const doc = await db.collection('jobs').doc(job.parentJobId).get();
                    if (doc.exists) {
                        setParentJob({ ...doc.data(), id: doc.id } as Job);
                    }
                } catch (err) {
                    console.error("Failed to load parent job", err);
                }
            } else {
                setParentJob(null);
            }
        };
        loadParentJob();
    }, [job.parentJobId]);

    const [workflowState, setWorkflowState] = useState<WorkflowState>({
        arrivalNotes: '',
        diagnosisNotes: '',
        workNotes: '',
        completionNotes: '',
        customerFeedback: '',
        diagnosisChecklist: [],
        qualityChecklist: [],
        membershipOffered: false,
        repairPostponed: job.repairPostponed || false,
        repairPostponedReason: job.repairPostponedReason || '',
        customerDetails: {
            email: job.customerEmail || state.customers?.find(c => c.id === job.customerId)?.email || '',
            phone: job.customerPhone || state.customers?.find(c => c.id === job.customerId)?.phone || '',
            address: getAddressString(job.address) || getAddressString(state.customers?.find(c => c.id === job.customerId)?.address) || ''
        },
        refrigerantLog: job.refrigerantLog || [],
        toolReadings: job.toolReadings || [],
        partsUsed: (job as any).partsUsed || [],
        techRecommendations: '',
        thankYouNote: job.notes?.thankYouNote || '',
        unitStates: []
    } as any);

    
    const assets = useMemo(() => {
        const customer = state.customers.find(c => c.id === job.customerId);
        let customerEquipment = customer?.equipment || [];
        
        const jobAddressStr = typeof job.address === 'string' ? job.address : '';
        let currentPropertyId = job.locationId;
        
        if (!currentPropertyId && jobAddressStr && customer?.serviceLocations) {
            const matchingLoc = customer.serviceLocations.find(loc => loc.address === jobAddressStr);
            if (matchingLoc) currentPropertyId = matchingLoc.id;
        }

        const getSubLocationIds = (parentId: string, locations: any[]): string[] => {
            const childIds = locations.filter(loc => loc.parentId === parentId).map(loc => loc.id);
            const nestedIds = childIds.flatMap(id => getSubLocationIds(id, locations));
            return [parentId, ...childIds, ...nestedIds];
        };
        
        if (currentPropertyId) {
            // Only show assets mapped to this property or its sub-locations.
            // If the customer has multiple locations, prevent unmapped assets from carrying over between them.
            const hasMultipleLocations = (customer?.serviceLocations?.length || 0) > 1;
            const validPropertyIds = customer?.serviceLocations
                ? getSubLocationIds(currentPropertyId, customer.serviceLocations)
                : [currentPropertyId];
            customerEquipment = customerEquipment.filter(e => (e.propertyId && validPropertyIds.includes(e.propertyId)) || (!hasMultipleLocations && !e.propertyId));
        } else if (customer?.serviceLocations && customer.serviceLocations.length > 1) {
            // If we can't determine the property but there are multiple properties, 
            // only show unmapped equipment to be safe, rather than everything
            customerEquipment = customerEquipment.filter(e => !e.propertyId);
        }
        
        return customerEquipment;
    }, [state.customers, job.customerId, job.locationId, job.address]);

    const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
    
    useEffect(() => {
        if (isOpen && initialEditingAssetId) {
            const asset = assets.find(a => a.id === initialEditingAssetId);
            if (asset) {
                setNewAsset(asset);
                setIsAddAssetOpen(true);
            }
            onClearInitialEditingAsset?.();
        }
    }, [isOpen, initialEditingAssetId, assets]);
    const [isOcrScanning, setIsOcrScanning] = useState(false);
    const [isResearching, setIsResearching] = useState(false);
    const [autoCreateThermostat, setAutoCreateThermostat] = useState(false);
    const [thermostatDetails, setThermostatDetails] = useState({
        name: 'Thermostat',
        brand: '',
        model: '',
        propertyId: '',
        physicalLocation: 'Interior Wall',
        exactPlacement: '',
        servesArea: ''
    });

    const [autoCreateAirHandler, setAutoCreateAirHandler] = useState(false);
    const [isResearchingAirHandler, setIsResearchingAirHandler] = useState(false);
    const [airHandlerDetails, setAirHandlerDetails] = useState({
        name: 'Air Handler',
        brand: '',
        model: '',
        serial: '',
        propertyId: '',
        physicalLocation: 'Interior Closet',
        exactPlacement: '',
        servesArea: '',
        year: '',
        tonnage: undefined as number | undefined,
        refrigerantType: '',
        heatType: '',
        electricityType: '',
        seerRating: '',
        filterType: ''
    });

    const [newAsset, setNewAsset] = useState<Omit<EquipmentAsset, 'id'> & { id?: string; serialPhotoUrl?: string; unitTagPhotoUrl?: string; conditionPhotoUrl?: string; exactPlacement?: string; servesArea?: string; gpsPin?: { lat: number; lng: number }; installDate?: string; notes?: string; linkedAssetIds?: string[]; name?: string; systemGroupId?: string | null; systemGroupName?: string | null; systemGroupRole?: string | null; assetTag?: string }>({ brand: '', model: '', serial: '', type: 'System' });

    useEffect(() => {
        if (isAddAssetOpen) {
            setAutoCreateThermostat(false);
            setThermostatDetails({
                name: 'Thermostat',
                brand: newAsset?.brand || '',
                model: '',
                propertyId: '',
                physicalLocation: 'Interior Wall',
                exactPlacement: '',
                servesArea: newAsset?.servesArea || ''
            });
            setAutoCreateAirHandler(false);
            setAirHandlerDetails({
                name: 'Air Handler',
                brand: newAsset?.brand || '',
                model: '',
                serial: '',
                propertyId: '',
                physicalLocation: 'Interior Closet',
                exactPlacement: '',
                servesArea: newAsset?.servesArea || '',
                year: '',
                tonnage: undefined,
                refrigerantType: '',
                heatType: '',
                electricityType: '',
                seerRating: '',
                filterType: ''
            });
        }
    }, [isAddAssetOpen, newAsset?.brand, newAsset?.servesArea]);

    // States and helper constants for linking refrigeration/split system group
    const [isLinkedToSystem, setIsLinkedToSystem] = useState(false);
    const [selectedSystemGroupId, setSelectedSystemGroupId] = useState('');
    const [newSystemGroupName, setNewSystemGroupName] = useState('');
    const [gpsLoading, setGpsLoading] = useState(false);

    const PHYSICAL_LOCATION_OPTIONS = [
        'Roof', 'Mechanical Room', 'Walk-in Cooler', 'Walk-in Freezer', 
        'Kitchen', 'Exterior Wall', 'Behind Building', 'Ceiling Space', 
        'Attic', 'Tenant Space', 'Other'
    ];

    const customerObj = state.customers?.find(c => c.id === job.customerId);
    const uniqueSystemGroups = useMemo(() => {
        const groups: Array<{ id: string; name: string; systemGroupName?: string }> = [];
        (customerObj?.equipment || []).forEach((e: EquipmentAsset) => {
            if (e.systemGroupId && !groups.some(g => g.id === e.systemGroupId)) {
                groups.push({ id: e.systemGroupId, name: e.systemGroupName || e.systemGroupId });
            }
        });
        return groups;
    }, [customerObj?.equipment]);

    useEffect(() => {
        if (isAddAssetOpen) {
            setIsLinkedToSystem(!!newAsset.systemGroupId);
            setSelectedSystemGroupId(newAsset.systemGroupId || '');
            setNewSystemGroupName('');
        }
    }, [isAddAssetOpen, newAsset.systemGroupId]);

    const handleSaveIntercept = () => {
        let sysId = newAsset.systemGroupId;
        let sysName = newAsset.systemGroupName;
        let sysRole = newAsset.systemGroupRole;

        if (isLinkedToSystem) {
            if (selectedSystemGroupId === 'NEW') {
                if (!newSystemGroupName.trim()) {
                    showToast.warn("System group name is required");
                    return;
                }
                sysId = `sys-${Date.now()}`;
                sysName = newSystemGroupName.trim();
            } else {
                const group = uniqueSystemGroups.find(g => g.id === selectedSystemGroupId);
                sysId = selectedSystemGroupId;
                sysName = group ? group.name : '';
            }
        } else {
            sysId = '';
            sysName = '';
            sysRole = '';
        }

        const activeAsset = {
            ...newAsset,
            systemGroupId: sysId || null,
            systemGroupName: sysName || null,
            systemGroupRole: sysRole || null
        };
        
        setTimeout(() => {
            handleAddAsset(activeAsset);
        }, 100);
    };

    const [files, setFiles] = useState<StoredFile[]>(job.files || []);

    const addFilesToJob = (newFiles: StoredFile[]) => {
        setFiles(prev => {
            const updated = [...prev, ...newFiles];
            onUpdate({ ...job, files: updated } as any);
            return updated;
        });
    };

    const removeFileFromJob = (fileToDelete: StoredFile) => {
        setFiles(prev => {
            const updated = prev.filter(f => f.id !== fileToDelete.id);
            onUpdate({ ...job, files: updated } as any);
            return updated;
        });
    };

    const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
    const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState(false);
    const [payableAmount, setPayableAmount] = useState<number>(0);
    
    // Tool Modals
    const [isLiveAssistOpen, setIsLiveAssistOpen] = useState(false);
    const [isWaiverOpen, setIsWaiverOpen] = useState(false);
    const [isSignOffOpen, setIsSignOffOpen] = useState(false);
    const [isSubBillOpen, setIsSubBillOpen] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<any | null>(null);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importTarget, setImportTarget] = useState<'diagnosis' | 'quality'>('diagnosis');
    const [isInvoiceEditorOpen, setIsInvoiceEditorOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isWebCameraOpen, setIsWebCameraOpen] = useState(false);
    const [viewingPhoto, setViewingPhoto] = useState<StoredFile | null>(null);
    const [assetCameraTarget, setAssetCameraTarget] = useState<'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl' | null>(null);

    // Data Capture Modals
    const [isRefrigerantModalOpen, setIsRefrigerantModalOpen] = useState(false);
    const [isToolReadingModalOpen, setIsToolReadingModalOpen] = useState(false);
    const [isPartModalOpen, setIsPartModalOpen] = useState(false);
    const [isIndustryToolsOpen, setIsIndustryToolsOpen] = useState(false);
    const [isProposalSelectorOpen, setIsProposalSelectorOpen] = useState(false);
    const [isInvoiceSelectorOpen, setIsInvoiceSelectorOpen] = useState(false);
    
    const [newReading, setNewReading] = useState<{ id: string; toolType: string; summary: string; phase: string; assetId: string; reportUrl: string; }>({ id: '', toolType: '', summary: '', phase: 'before', assetId: '', reportUrl: '' });
    const [isUploadingDiagnostic, setIsUploadingDiagnostic] = useState(false);
    const [uploadedDiagnosticName, setUploadedDiagnosticName] = useState('');
    const [refrigerantEntry, setRefrigerantEntry] = useState({ type: 'R-410A', action: 'Added', amount: '', unit: 'oz', cylinderNumber: '' });
    const [customCylString, setCustomCylString] = useState('');
    const [partSearch, setPartSearch] = useState('');
    const [selectedPart, setSelectedPart] = useState<any>(null);
    const [partQuantity, setPartQuantity] = useState(1);
    const [partLocation, setPartLocation] = useState('Truck');

    const prevJobRef = useRef<Job | null>(null);
    const prevCustomerRef = useRef<Customer | null>(null);

    const docTemplates = useMemo(() => {
        let templates = state.inspectionTemplates || [];
        if (job.assignedPartnerId === state.currentOrganization?.id && job.embeddedData?.inspectionTemplates && job.embeddedData.inspectionTemplates.length > 0) {
            templates = job.embeddedData.inspectionTemplates;
        }
        return templates.filter((t: InspectionTemplate) => !t.isHiringPacket);
    }, [state.inspectionTemplates, job, state.currentOrganization]);



    const generateItemsFromIds = (ids: string[], templates: InspectionTemplate[]): ChecklistItem[] => {
        return ids.flatMap(id => {
            const t = templates.find(tpl => tpl.id === id);
            return t ? t.items.map((i, idx) => ({ id: `auto-${t.id}-${idx}-${Date.now()}`, label: i.label, completed: false, hiddenFromCustomer: false })) : [];
        });
    };

    useEffect(() => {
        if (!isOpen) {
            prevJobRef.current = null;
            prevCustomerRef.current = null;
            return;
        }

        const customer = state.customers.find(c => c.id === job.customerId);
        const prevJob = prevJobRef.current;
        const prevCustomer = prevCustomerRef.current;

        setWorkflowState((prevState: any) => {
            const shouldUpdate = (currentVal: any, prevJobVal: any, newJobVal: any) => {
                if (!prevJob) return true;
                return currentVal === (prevJobVal || '');
            };

            const shouldUpdateObj = (currentVal: any, prevVal: any, newVal: any) => {
                if (!prevJob) return true;
                return JSON.stringify(currentVal) === JSON.stringify(prevVal || []);
            };

            const shouldUpdateChecklist = (currentVal: any, prevJobStr: string | undefined, initialVal: any) => {
                if (!prevJob) return true;
                const prevParsed = prevJobStr ? JSON.parse(prevJobStr) : initialVal;
                return JSON.stringify(currentVal) === JSON.stringify(prevParsed);
            };

            const newArrivalNotes = shouldUpdate(prevState.arrivalNotes, prevJob?.notes?.arrival, job.notes?.arrival)
                ? (job.notes?.arrival || '') : prevState.arrivalNotes;

            const newDiagnosisNotes = shouldUpdate(prevState.diagnosisNotes, prevJob?.notes?.diagnosis, job.notes?.diagnosis)
                ? (job.notes?.diagnosis || '') : prevState.diagnosisNotes;

            const newWorkNotes = shouldUpdate(prevState.workNotes, prevJob?.notes?.work, job.notes?.work)
                ? (job.notes?.work || '') : prevState.workNotes;

            const newCompletionNotes = shouldUpdate(prevState.completionNotes, prevJob?.notes?.completion, job.notes?.completion)
                ? (job.notes?.completion || '') : prevState.completionNotes;

            const newThankYouNote = shouldUpdate(prevState.thankYouNote, prevJob?.notes?.thankYouNote, job.notes?.thankYouNote)
                ? (job.notes?.thankYouNote || '') : prevState.thankYouNote;

            const newCustomerFeedback = shouldUpdate(prevState.customerFeedback, prevJob?.customerFeedback, job.customerFeedback)
                ? (job.customerFeedback || '') : prevState.customerFeedback;

            const newTechRecommendations = shouldUpdate(prevState.techRecommendations, prevJob?.techRecommendations, job.techRecommendations)
                ? (job.techRecommendations || '') : prevState.techRecommendations;

            const newRepairPostponed = shouldUpdate(prevState.repairPostponed, prevJob?.repairPostponed, job.repairPostponed)
                ? (job.repairPostponed || false) : prevState.repairPostponed;

            const newRepairPostponedReason = shouldUpdate(prevState.repairPostponedReason, prevJob?.repairPostponedReason, job.repairPostponedReason)
                ? (job.repairPostponedReason || '') : prevState.repairPostponedReason;

            const prevCustEmail = prevJob?.customerEmail || prevCustomer?.email || '';
            const newCustEmail = job.customerEmail || customer?.email || '';
            const emailVal = shouldUpdate(prevState.customerDetails?.email, prevCustEmail, newCustEmail)
                ? newCustEmail : (prevState.customerDetails?.email || '');

            const prevCustPhone = prevJob?.customerPhone || prevCustomer?.phone || '';
            const newCustPhone = job.customerPhone || customer?.phone || '';
            const phoneVal = shouldUpdate(prevState.customerDetails?.phone, prevCustPhone, newCustPhone)
                ? newCustPhone : (prevState.customerDetails?.phone || '');

            const prevCustAddr = getAddressString(prevJob?.address) || getAddressString(prevCustomer?.address) || '';
            const newCustAddr = getAddressString(job.address) || getAddressString(customer?.address) || '';
            const addressVal = shouldUpdate(prevState.customerDetails?.address, prevCustAddr, newCustAddr)
                ? newCustAddr : (prevState.customerDetails?.address || '');

            const newRefrigerantLog = shouldUpdateObj(prevState.refrigerantLog, prevJob?.refrigerantLog, job.refrigerantLog)
                ? (job.refrigerantLog || []) : prevState.refrigerantLog;

            const newToolReadings = shouldUpdateObj(prevState.toolReadings, prevJob?.toolReadings, job.toolReadings)
                ? (job.toolReadings || []) : prevState.toolReadings;

            const newPartsUsed = shouldUpdateObj((prevState as any).partsUsed, (prevJob as any)?.partsUsed, (job as any).partsUsed)
                ? ((job as any).partsUsed || []) : (prevState as any).partsUsed;

            const newUnitStates = shouldUpdateObj(prevState.unitStates, prevJob?.unitStates, job.unitStates)
                ? (job.unitStates || []) : prevState.unitStates;

            const initialDiagnosisChecklist = generateItemsFromIds(job.requiredDiagnosisChecklistIds || (job as any).requiredDiagnosticChecklistIds || [], docTemplates);
            const initialQualityChecklist = generateItemsFromIds(job.requiredQualityChecklistIds || [], docTemplates);

            const newDiagnosisChecklist = shouldUpdateChecklist(prevState.diagnosisChecklist, prevJob?.notes?.diagnosisChecklist, initialDiagnosisChecklist)
                ? (() => {
                    if (!job.notes?.diagnosisChecklist) return initialDiagnosisChecklist;
                    try {
                        const parsed = JSON.parse(job.notes.diagnosisChecklist);
                        return parsed.length > 0 ? parsed : initialDiagnosisChecklist;
                    } catch (e) {
                        return initialDiagnosisChecklist;
                    }
                })()
                : prevState.diagnosisChecklist;

            const newQualityChecklist = shouldUpdateChecklist(prevState.qualityChecklist, prevJob?.notes?.qualityChecklist, initialQualityChecklist)
                ? (() => {
                    if (!job.notes?.qualityChecklist) return initialQualityChecklist;
                    try {
                        const parsed = JSON.parse(job.notes.qualityChecklist);
                        return parsed.length > 0 ? parsed : initialQualityChecklist;
                    } catch (e) {
                        return initialQualityChecklist;
                    }
                })()
                : prevState.qualityChecklist;

            return {
                ...prevState,
                arrivalNotes: newArrivalNotes,
                diagnosisNotes: newDiagnosisNotes,
                workNotes: newWorkNotes,
                completionNotes: newCompletionNotes,
                thankYouNote: newThankYouNote,
                customerFeedback: newCustomerFeedback,
                techRecommendations: newTechRecommendations,
                customerDetails: {
                    email: emailVal,
                    phone: phoneVal,
                    address: addressVal
                },
                refrigerantLog: newRefrigerantLog,
                toolReadings: newToolReadings,
                partsUsed: newPartsUsed,
                unitStates: newUnitStates,
                diagnosisChecklist: newDiagnosisChecklist,
                qualityChecklist: newQualityChecklist,
                repairPostponed: newRepairPostponed,
                repairPostponedReason: newRepairPostponedReason
            };
        });

        setFiles(job.files || []);

        prevJobRef.current = job;
        prevCustomerRef.current = customer || null;
    }, [isOpen, job, state.customers, docTemplates]);

    useEffect(() => {
        if (isOpen && job.address) {
            geocodeAddress(job.address).then(coords => {
                if (coords) {
                    console.log("[JobWorkflowModal] Resolved job site coordinates:", coords);
                    setJobSiteCoords(coords);
                }
            });
        }
    }, [isOpen, job.address]);

    useEffect(() => {
        const isCurrentlyCheckedIn = job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime());
        if (!isOpen || isCurrentlyCheckedIn || !jobSiteCoords) return;

        let intervalId: any = null;

        const checkGeofence = async () => {
            const currentLoc = await getCurrentLocation();
            if (currentLoc && jobSiteCoords) {
                const dist = calculateDistance(
                    currentLoc.latitude,
                    currentLoc.longitude,
                    jobSiteCoords.lat,
                    jobSiteCoords.lng
                );
                console.log(`[Geofence] Tech distance to job site: ${dist.toFixed(1)} meters`);
                if (dist <= 300) {
                    console.log("[Geofence] Tech entered radius of job site. Triggering auto-checkin.");
                    if (intervalId) clearInterval(intervalId);
                    
                    const now = new Date().toISOString();
                    const updatedEntries = [...(job.timeEntries || []), { checkInTime: now, checkOutTime: null, timeOnSiteMinutes: null }];
                    await handleJobUpdate({
                        checkInTime: now,
                        timeEntries: updatedEntries,
                        jobStatus: 'In Progress'
                    });
                    showToast.success("Arrived on site! Job timer started automatically.");
                }
            }
        };

        checkGeofence();
        intervalId = setInterval(checkGeofence, 30000);

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isOpen, job.checkInTime, job.checkOutTime, jobSiteCoords]);

    useEffect(() => {
        if (isOpen) {
            const initialDiagnosisChecklist = generateItemsFromIds(job.requiredDiagnosisChecklistIds || (job as any).requiredDiagnosticChecklistIds || [], docTemplates);
            const initialQualityChecklist = generateItemsFromIds(job.requiredQualityChecklistIds || [], docTemplates);
            
            setWorkflowState((prevState: any) => {
                let diag = initialDiagnosisChecklist;
                if (job.notes?.diagnosisChecklist) {
                    try {
                        const parsed = JSON.parse(job.notes.diagnosisChecklist);
                        if (parsed.length > 0) diag = parsed;
                    } catch (e) {
                        console.error("Failed to parse diagnosisChecklist:", e);
                    }
                }

                let qual = initialQualityChecklist;
                if (job.notes?.qualityChecklist) {
                    try {
                        const parsed = JSON.parse(job.notes.qualityChecklist);
                        if (parsed.length > 0) qual = parsed;
                    } catch (e) {
                        console.error("Failed to parse qualityChecklist:", e);
                    }
                }

                return {
                    ...prevState,
                    diagnosisChecklist: diag,
                    qualityChecklist: qual,
                };
            });

            const savedStep = sessionStorage.getItem(`workflow_step_${job.id}`);
            setStep(1); // Legacy, keeping for fallback
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, job.id]);

    const activeSteps = useMemo(() => {
        const vt = job.visitType || 'Repair';
        const steps = ['arrival'];
        if (vt.includes('Diagnostic') || vt === 'Service Call' || vt === 'Diagnostic & Repair' || vt === 'Diagnostic Only') steps.push('diagnosis');
        if (vt.includes('Repair') || vt === 'Maintenance' || vt === 'Service Call' || vt === 'Other' || vt === 'Diagnostic & Repair') steps.push('repair');
        steps.push('quality');
        steps.push('billing');
        return steps;
    }, [job.visitType]);

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        arrival: !job.checkInTime || (!!job.checkInTime && !!job.checkOutTime),
        diagnosis: !!job.checkInTime && !job.checkOutTime && (job.jobStatus === 'In Progress' || !job.jobStatus),
        repair: !!job.checkInTime && !job.checkOutTime && (job.jobStatus === 'In Progress' || !job.jobStatus),
        quality: job.jobStatus === 'Completed',
        billing: job.jobStatus === 'Completed'
    });

    const sectionRefs = {
        arrival: useRef<HTMLDivElement>(null),
        diagnosis: useRef<HTMLDivElement>(null),
        repair: useRef<HTMLDivElement>(null),
        quality: useRef<HTMLDivElement>(null),
        billing: useRef<HTMLDivElement>(null)
    };

    const scrollToSection = (section: string) => {
        setExpandedSections(prev => ({...prev, [section]: true}));
        setTimeout(() => {
            if (sectionRefs[section as keyof typeof sectionRefs]?.current) {
                sectionRefs[section as keyof typeof sectionRefs].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    const [shouldRollChargesAfterScheduling, setShouldRollChargesAfterScheduling] = useState(false);
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);

    useEffect(() => {
        if (shouldRollChargesAfterScheduling && state.jobs.length > 0) {
            const newJobs = state.jobs.filter(j => j.customerId === job.customerId && j.id !== job.id && new Date(j.createdAt || '').getTime() > Date.now() - 60000);
            if (newJobs.length > 0) {
                const targetJob = newJobs[0];
                handleRollPaymentToJob(targetJob.id);
                setShouldRollChargesAfterScheduling(false);
            }
        }
    }, [state.jobs, shouldRollChargesAfterScheduling, job.customerId, job.id]);

    const handleRollPaymentToJob = async (targetJobId: string) => {
        const targetJob = state.jobs.find(j => j.id === targetJobId);
        if (targetJob) {
             const itemsToCopy = job.invoice?.items?.map(item => ({
                 ...item,
                 id: `roll-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                 description: `${item.description} (Rolled from Job #${job.id.slice(-6).toUpperCase()})`
             })) || [];
             
             const targetInvoice = targetJob.invoice || {
                 id: `INV-${Date.now()}`,
                 items: [],
                 subtotal: 0,
                 taxRate: (state.currentOrganization?.taxRate || 8.25) / 100,
                 taxAmount: 0,
                 totalAmount: 0,
                 amount: 0,
                 status: 'Unpaid'
             };

             const targetLines = [...(targetInvoice.items || []), ...itemsToCopy];
             const subtotal = targetLines.reduce((acc, l) => acc + (l.total || (l.quantity * l.unitPrice) || 0), 0);
             const taxAmount = subtotal * (targetInvoice.taxRate || 0.0825); 
             const totalAmount = subtotal + taxAmount;

             const updatedTargetInvoice = {
                 ...targetInvoice,
                 items: targetLines,
                 subtotal,
                 taxAmount,
                 totalAmount,
                 amount: totalAmount,
                 status: 'Unpaid' as const
             };

             if (!state.isDemoMode) {
                 await db.collection('jobs').doc(targetJob.id).update(cleanUndefinedFields({ 
                     invoice: updatedTargetInvoice, 
                     parentJobId: job.id 
                 }));
             }
             dispatch({
                 type: 'UPDATE_JOB',
                 payload: {
                     ...targetJob,
                     invoice: updatedTargetInvoice,
                     parentJobId: job.id
                 }
             });

             const updatedCurrentInvoice = {
                 ...(job.invoice || {}),
                 status: 'Pending' as const,
                 notes: `${job.invoice?.notes || ''}\n[DEFERRED] Charges rolled forward to Job #${targetJob.id.slice(-6).toUpperCase()}`
             };

             await handleJobUpdate({ 
                 invoice: updatedCurrentInvoice as any, 
                 rolledToJobId: targetJob.id,
                 rolledForward: true,
                 parentJobId: targetJob.id
             });
             showToast.success("Payment rolled to next visit!");
        }
    };

    const handleUpgradeToRepair = async () => {
        await handleJobUpdate({ visitType: 'Diagnostic & Repair' });
        showToast.success("Upgraded to Repair!");
        scrollToSection('repair');
    };

    const validateBeforeComplete = (): string | null => {
        if (activeSteps.includes('diagnosis') && !workflowState.diagnosisNotes) return 'diagnosis';
        if (activeSteps.includes('repair') && !workflowState.workNotes) return 'repair';
        return null;
    };

    const updateWorkflowState = <K extends keyof WorkflowState>(key: K, value: WorkflowState[K]) => {
        setWorkflowState(prev => ({ ...prev, [key]: value }));
    };

    const handleJobUpdate = async (updates: Partial<Job & { notes: any, partsUsed: any[] }>) => {
        setIsSaving(true);
        try {
            const rawUpdates: any = { 
                ...updates,
                updatedAt: new Date().toISOString(),
                updatedById: state.currentUser?.id || null,
                updatedByName: state.currentUser ? `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() : null
            };

            if (updates.jobStatus && updates.jobStatus !== job.jobStatus) {
                rawUpdates.jobEvents = [...(job.jobEvents || []), {
                    type: 'Status Change',
                    status: updates.jobStatus,
                    timestamp: new Date().toISOString(),
                    userId: state.currentUser?.id || null
                }];
            }

            const fullUpdates = cleanUndefinedFields(rawUpdates);

            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping Firestore update.", fullUpdates);
                onUpdate({ ...job, ...fullUpdates, notes: { ...job.notes, ...fullUpdates.notes } } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(fullUpdates));
                onUpdate({ ...job, ...fullUpdates, notes: { ...job.notes, ...fullUpdates.notes } } as any);
            }
        } catch (e) {
            console.error("Update failed:", e);
            showToast.error("There was an error saving the job. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCheckIn = async () => {
        const now = new Date().toISOString();
        const updatedEntries = [...(job.timeEntries || [])];

        if (job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime())) {
            const confirmReset = await globalConfirm(
                "You are already checked in. Would you like to reset your arrival time and restart the timer to now?",
                "Reset Arrival Time",
                "Yes, Reset",
                "Cancel"
            );
            if (!confirmReset) return;

            // Reset/update the last incomplete entry
            if (updatedEntries.length > 0) {
                updatedEntries[updatedEntries.length - 1] = {
                    ...updatedEntries[updatedEntries.length - 1],
                    checkInTime: now,
                    checkOutTime: null,
                    timeOnSiteMinutes: null
                };
            } else {
                updatedEntries.push({ checkInTime: now, checkOutTime: null, timeOnSiteMinutes: null });
            }

            await handleJobUpdate({
                checkInTime: now,
                checkOutTime: null as any,
                timeEntries: updatedEntries,
                jobStatus: 'In Progress'
            });
        } else {
            // New check-in visit day
            updatedEntries.push({ checkInTime: now, checkOutTime: null, timeOnSiteMinutes: null });
            await handleJobUpdate({
                checkInTime: now,
                checkOutTime: null as any,
                timeEntries: updatedEntries,
                jobStatus: 'In Progress'
            });
        }
        showToast.success(job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime()) ? "Arrival time reset successfully!" : "Checked in! Job timer started.");
    };

    const handleStopClock = async () => {
        const confirmStop = await globalConfirm(
            "Are you sure you want to stop the clock and record your departure time? This will check you out for this visit without marking the job as completed.",
            "Stop Clock / Leave Site",
            "Confirm",
            "Cancel"
        );
        if (!confirmStop) return;

        setIsSaving(true);
        try {
            await saveCurrentState();
            const nowStr = new Date().toISOString();
            const checkIn = job.checkInTime || nowStr;
            const durationMs = new Date(nowStr).getTime() - new Date(checkIn).getTime();
            const currentMins = Math.max(0, Math.round(durationMs / 60000));
            
            const updatedEntries = [...(job.timeEntries || [])];
            if (updatedEntries.length > 0) {
                const lastIdx = updatedEntries.length - 1;
                updatedEntries[lastIdx] = {
                    ...updatedEntries[lastIdx],
                    checkOutTime: nowStr,
                    timeOnSiteMinutes: currentMins
                };
            } else {
                updatedEntries.push({
                    checkInTime: checkIn,
                    checkOutTime: nowStr,
                    timeOnSiteMinutes: currentMins
                });
            }

            const totalMins = updatedEntries.reduce((acc, entry) => acc + (entry.timeOnSiteMinutes || 0), 0);

            await handleJobUpdate({
                checkOutTime: nowStr,
                timeOnSiteMinutes: totalMins,
                timeEntries: updatedEntries
            });
            showToast.success("Checked out! Job clock stopped.");
            onClose();
        } catch (e) {
            console.error("Failed to stop clock:", e);
            showToast.error("Failed to stop clock.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleStartRoute = async () => {
        const now = new Date().toISOString();
        await handleJobUpdate({
            transitStartTime: now
        });
        
        const customer = state.customers?.find(c => c.id === job.customerId);
        
        // 1. Send SMS to customer (via Firestore queue)
        if (job.customerId) {
            try {
                await db.collection('messages').add(cleanUndefinedFields({
                    type: 'sms',
                    receiverId: job.customerId,
                    content: `Hello! Your technician, ${state.currentUser?.firstName || 'our technician'}, is en route to your location for your scheduled service.`,
                    organizationId: job.organizationId || state.currentUser?.organizationId || 'system',
                    senderId: state.currentUser?.id || 'system',
                    createdAt: new Date().toISOString()
                }));
            } catch (err) {
                console.error("Failed to queue SMS notification:", err);
            }
        }
        
        // 2. Send Email to customer
        const recipientEmail = job.customerEmail || customer?.email;
        if (recipientEmail) {
            try {
                const { sendEmail: triggerEmail } = await import('../../../lib/mailService');
                const techName = state.currentUser 
                    ? `${state.currentUser.firstName} ${state.currentUser.lastName}`
                    : 'Your Technician';
                await triggerEmail({
                    to: recipientEmail,
                    subject: `Your technician is on the way!`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #4f46e5;">On Our Way!</h2>
                            <p>Hello ${job.customerName || 'Customer'},</p>
                            <p>Your technician, <strong>${techName}</strong>, is en route to your location for your scheduled service.</p>
                            <p><strong>Service Location:</strong> ${typeof job.address === 'string' ? job.address : (job.address as any)?.street || ''}</p>
                            <p>We will see you shortly!</p>
                        </div>
                    `,
                    organizationId: job.organizationId || 'system',
                    bypassOptOut: true
                });
            } catch (err) {
                console.error("Failed to send email notification:", err);
            }
        }
        
        showToast.success("Started transit! Customer notified via SMS/Email.");
    };
    
    const saveCurrentState = async () => {
        const updates = {
            notes: {
                arrival: workflowState.arrivalNotes,
                diagnosis: workflowState.diagnosisNotes,
                work: workflowState.workNotes,
                completion: workflowState.completionNotes,
                thankYouNote: workflowState.thankYouNote || '',
                diagnosisChecklist: JSON.stringify(workflowState.diagnosisChecklist),
                qualityChecklist: JSON.stringify(workflowState.qualityChecklist),
            },
            customerFeedback: workflowState.customerFeedback,
            customerEmail: workflowState.customerDetails.email,
            customerPhone: workflowState.customerDetails.phone,
            address: workflowState.customerDetails.address,
            refrigerantLog: workflowState.refrigerantLog || [],
            toolReadings: workflowState.toolReadings || [],
            partsUsed: (workflowState as any).partsUsed || [],
            techRecommendations: workflowState.techRecommendations || '',
            unitStates: workflowState.unitStates || [],
            repairPostponed: workflowState.repairPostponed || false,
            repairPostponedReason: workflowState.repairPostponedReason || ''
        };

        
        // Ensure customer record is also updated with new potential address, email, and phone
        const customer = state.customers.find(c => c.id === job.customerId);
        if (customer) {
             const customerUpdates: any = {};
             let doUpdate = false;
             
             // Sync equipment health back to customer equipment conditions
             const localEquipment = customer.equipment || [];
             let equipmentUpdated = false;
             
             const updatedEquipment = localEquipment.map((eq: EquipmentAsset) => {
                 const stateForEq = workflowState.unitStates?.find(s => s.assetId === eq.id);
                 if (stateForEq && stateForEq.health) {
                     const newCondition = stateForEq.health; // 'Good' | 'Fair' | 'Critical'
                     if (eq.condition !== newCondition) {
                         equipmentUpdated = true;
                         return { ...eq, condition: newCondition };
                     }
                 }
                 return eq;
             });

             if (equipmentUpdated) {
                 customerUpdates.equipment = updatedEquipment;
                 doUpdate = true;
             }
             
             if (workflowState.customerDetails.address && customer.address !== workflowState.customerDetails.address) {
                 // Decouple job address updates from the customer's billing address.
                 // This allows independent addresses across jobs and prevents propagating changes to other jobs.
                 // The new address will still be added as a Service Location on file below.
             }

             if (workflowState.customerDetails.email && customer.email !== workflowState.customerDetails.email) {
                 customerUpdates.email = workflowState.customerDetails.email;
                 doUpdate = true;
             }

             if (workflowState.customerDetails.phone && customer.phone !== workflowState.customerDetails.phone) {
                 customerUpdates.phone = workflowState.customerDetails.phone;
                 doUpdate = true;
             }
             
             // Also add as a ServiceLocation if it exists
             if (workflowState.customerDetails.address) {
                 const currentLocations = customer.serviceLocations ? [...customer.serviceLocations] : [];
                 if (!currentLocations.some((loc: any) => loc.address === workflowState.customerDetails.address)) {
                     currentLocations.push({ id: `loc-${Date.now()}`, name: 'New Location', address: workflowState.customerDetails.address });
                     customerUpdates.serviceLocations = currentLocations;
                     doUpdate = true;
                 }
             }

             if (doUpdate) {
                 try {
                     if (!state.isDemoMode) {
                          await db.collection('customers').doc(customer.id).update(cleanUndefinedFields(customerUpdates));
                     }
                 } catch (err) {
                      console.error("Failed to update customer in Firestore:", err);
                 }
                 dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, ...customerUpdates } });

                 // Sync to all other active/incomplete jobs for this customer
                 const otherActiveJobs = state.jobs.filter(j => 
                     j.customerId === customer.id && 
                     j.id !== job.id && 
                     j.jobStatus !== 'Completed' && 
                     j.jobStatus !== 'Cancelled'
                 );

                 otherActiveJobs.forEach(async (oj) => {
                     const ojUpdates: Partial<Job> = {};
                     if (customerUpdates.email !== undefined) {
                         ojUpdates.customerEmail = customerUpdates.email || null;
                     }
                     if (customerUpdates.phone !== undefined) {
                         ojUpdates.customerPhone = customerUpdates.phone || null;
                     }
                     if (customerUpdates.address !== undefined && oj.address === customer.address) {
                         ojUpdates.address = customerUpdates.address || null;
                     }
                     if (Object.keys(ojUpdates).length === 0) return;
                     try {
                         if (!state.isDemoMode) {
                             await db.collection('jobs').doc(oj.id).update(cleanUndefinedFields(ojUpdates));
                         }
                     } catch (err) {
                         console.error(`Failed to update other job ${oj.id}:`, err);
                     }
                     dispatch({ type: 'UPDATE_JOB', payload: { id: oj.id, ...ojUpdates } });
                 });
             }
        }
        
        await handleJobUpdate(updates as any);
    };

    const handleStepAdvance = async (nextStep: number) => {
        const extraUpdates: any = {};
        
        if (nextStep >= 2 && !job.checkInTime) {
            let shouldCheckIn = false;
            let currentLoc = null;
            try {
                currentLoc = await getCurrentLocation();
            } catch (err) {
                console.warn("Could not get technician location:", err);
            }

            if (currentLoc && jobSiteCoords) {
                const dist = calculateDistance(
                    currentLoc.latitude,
                    currentLoc.longitude,
                    jobSiteCoords.lat,
                    jobSiteCoords.lng
                );
                console.log(`[handleStepAdvance] Distance check: ${dist.toFixed(1)} meters`);
                if (dist <= 300) {
                    shouldCheckIn = true;
                } else {
                    showToast.warn("Pre-arrival prep mode active. Job timer will start when you check in on site.");
                }
            } else {
                // If coordinates are unavailable, prompt the user
                const isOnSite = await globalConfirm(
                    "We could not verify your physical location. Are you currently on site at the customer's property?",
                    "Location Verification",
                    "Yes, Start Timer",
                    "No, Prepare Proposal Only"
                );
                if (isOnSite) {
                    shouldCheckIn = true;
                } else {
                    showToast.warn("Pre-arrival prep mode active. Job timer will start when you check in on site.");
                }
            }

            if (shouldCheckIn) {
                extraUpdates.checkInTime = new Date().toISOString();
                extraUpdates.jobStatus = 'In Progress';
            }
        } else if (nextStep >= 2 && job.jobStatus !== 'In Progress') {
            extraUpdates.jobStatus = 'In Progress';
        }

        if (Object.keys(extraUpdates).length > 0) {
            await handleJobUpdate(extraUpdates);
        }
        await saveCurrentState();
        setStep(nextStep);
    };

    const handleAssetPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl') => {
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
                if (!state.isDemoMode) {
                    await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({
                        files: firebase.firestore.FieldValue.arrayUnion(newFileReference)
                    }));
                }
                dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, files: [...(customer.files || []), newFileReference] } });
            }
            
            let extractedSerial = newAsset.serial;
            let extractedModel = newAsset.model;

            if (photoType === 'serialPhotoUrl' || photoType === 'unitTagPhotoUrl') {
                setIsOcrScanning(true);
                try {
                    const result = await Tesseract.recognize(file, 'eng');
                    const text = result.data.text.toUpperCase();
                    console.log("[OCR Raw Scanned Text]:", text);
                    
                    // Advanced HVAC Nameplate Keywords
                    const serialKeywords = [
                        'SERIAL NO', 'SERIAL N0', 'SERIAL NUM', 'SERIAL', 'SER. NO', 'SER NO', 'SER. N0', 'SER N0', 'SER.', 'SER', 
                        'S/N', 'S/N:', 'S.N', 'S. N', 'S N', 'SN:', 'SN '
                    ];

                    const modelKeywords = [
                        'MODEL NO', 'MODEL N0', 'MODEL NUM', 'MODEL', 'MOD. NO', 'MOD NO', 'MOD. N0', 'MOD N0', 'MOD.', 'MOD', 
                        'M/N', 'M/N:', 'M.N', 'M. N', 'M N', 'MN:', 'MN '
                    ];

                    const serialRegexPattern = /^\s*[:#=\-\s]*\s*([A-Z0-9]{5,20})/i;
                    const modelRegexPattern = /^\s*[:#=\-\s]*\s*([A-Z0-9\-\/\.]{5,25})/i;

                    // 1. Contextual Line matching
                    const findContextualMatch = (textStr: string, keywords: string[], pattern: RegExp): string | null => {
                        const lines = textStr.split('\n');
                        for (const line of lines) {
                            for (const kw of keywords) {
                                const index = line.indexOf(kw);
                                if (index !== -1) {
                                    const sub = line.substring(index + kw.length);
                                    const match = sub.match(pattern);
                                    if (match && match[1]) {
                                        return match[1].trim().toUpperCase();
                                    }
                                }
                            }
                        }
                        return null;
                    };

                    let matchedSerial = findContextualMatch(text, serialKeywords, serialRegexPattern);
                    let matchedModel = findContextualMatch(text, modelKeywords, modelRegexPattern);

                    // 2. Global Regex fallback if line matching fails
                    if (!matchedSerial) {
                        const serialMatch = text.match(/(?:S\/?N|SERIAL|SER\.?\s*N[O0]|SER\.?)\s*[:#=\-\s]*\s*([A-Z0-9]{5,20})/i);
                        if (serialMatch && serialMatch[1]) {
                            matchedSerial = serialMatch[1].toUpperCase();
                        }
                    }
                    if (!matchedModel) {
                        const modelMatch = text.match(/(?:M\/?N|MODEL|MOD\.?\s*N[O0]|MOD\.?)\s*[:#=\-\s]*\s*([A-Z0-9\-\/\.]{5,25})/i);
                        if (modelMatch && modelMatch[1]) {
                            matchedModel = modelMatch[1].toUpperCase();
                        }
                    }

                    // 3. Last resort fallback: typical HVAC serial number lengths
                    if (!matchedSerial) {
                        const words = text.match(/\b[A-Z0-9]{8,15}\b/g) || [];
                        const commonLabels = ['SERIAL', 'MODEL', 'CARRIER', 'TRANE', 'LENNOX', 'GOODMAN', 'YORK', 'RHEEM', 'RUUD', 'DAIKIN'];
                        const candidates = words.filter((w: string) => !commonLabels.includes(w));
                        if (candidates.length > 0) {
                            matchedSerial = candidates[0].toUpperCase();
                        }
                    }

                    if (matchedSerial) extractedSerial = matchedSerial;
                    if (matchedModel) extractedModel = matchedModel;

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

    const handleResearchSpecs = async () => {
        if (!newAsset?.model) {
            showToast.error("Model Number is required to research specifications.");
            return;
        }

        setIsResearching(true);
        try {
            const fns = getFunctions();
            const callGeminiAI = httpsCallable(fns, 'callGeminiAI');

            const brand = newAsset.brand || 'Unknown Brand';
            const model = newAsset.model;
            const serial = newAsset.serial || '';

            const prompt = `Senior HVAC & Appliance Technical Advisor.
Research and decode technical specs for this unit:
- Manufacturer/Brand: \${brand}
- Model Number: \${model}
- Serial Number: \${serial}

Your task is to decode the model/serial numbers or look up standard specs to fill out the following properties:
1. "year": Decode the manufacturing year from the serial number format (e.g., first 2 or 4 digits, or letter date code depending on brand). E.g. "2018".
2. "tonnage": Decode capacity/tonnage from model number BTUs (e.g. 024 = 2 tons, 036 = 3 tons, 042 = 3.5 tons, 048 = 4 tons, 060 = 5 tons). Return a number.
3. "refrigerantType": E.g. "R410A", "R22", "R134a", "R404A".
4. "heatType": E.g. "Gas", "Electric", "Heat Pump", "N/A".
5. "seerRating": Standard SEER rating for this model series (e.g. "14", "16", "21").
6. "electricityType": E.g. "230V / 1ph", "460V / 3ph", "115V / 1ph".
7. "filterType": Standard filter dimensions and type if it's a standard cabinet size (e.g., "20x25x1 MERV 11").

CRITICAL SAFETY RULES:
- DO NOT make up, guess, or hallucinate any information.
- Only return a value for a property if it is GUARANTEED or highly confident based on standard brand coding structures or verified manufacturer documentation.
- If a property cannot be confidently verified, set its value to null (do NOT make up placeholder values, guess years, or guess SEER ratings).
- If the serial number is blank or does not conform to date coding, set "year" to null.
- If the model is unrecognized or fake, set all spec fields to null.

Return ONLY a valid JSON object matching this schema with NO markdown wrapper:
{
  "year": string | null,
  "tonnage": number | null,
  "refrigerantType": string | null,
  "heatType": string | null,
  "seerRating": string | null,
  "electricityType": string | null,
  "filterType": string | null
}`;

            const result: any = await callGeminiAI({
                prompt,
                modelName: 'gemini-3.6-flash',
                config: { response_mime_type: 'application/json' }
            });

            const cleanJson = (result.data?.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const specs = JSON.parse(cleanJson);

            const hasSpecs = Object.values(specs).some(val => val !== null && val !== undefined && val !== '');

            if (!hasSpecs) {
                showToast.warn("No verified specifications could be confidently determined for this model/serial.");
                setIsResearching(false);
                return;
            }

            const updatedAsset = { ...newAsset };
            let count = 0;

            if (specs.year && !updatedAsset.year) {
                updatedAsset.year = specs.year;
                count++;
            }
            if (specs.tonnage && (updatedAsset.tonnage === undefined || updatedAsset.tonnage === null)) {
                updatedAsset.tonnage = Number(specs.tonnage);
                count++;
            }
            if (specs.refrigerantType && !updatedAsset.refrigerantType) {
                updatedAsset.refrigerantType = specs.refrigerantType;
                count++;
            }
            if (specs.heatType && !updatedAsset.heatType) {
                updatedAsset.heatType = specs.heatType;
                count++;
            }
            if (specs.electricityType && !updatedAsset.electricityType) {
                updatedAsset.electricityType = specs.electricityType;
                count++;
            }
            if (specs.seerRating && !updatedAsset.seerRating) {
                updatedAsset.seerRating = specs.seerRating;
                count++;
            }
            if (specs.filterType && !updatedAsset.filterType) {
                updatedAsset.filterType = specs.filterType;
                count++;
            }

            setNewAsset(updatedAsset);
            if (count > 0) {
                showToast.success(`Successfully populated \${count} technical specifications!`);
            } else {
                showToast.info("AI lookup completed, but no new details were added (existing fields were preserved or no new confident specs found).");
            }
        } catch (error) {
            console.error(error);
            showToast.error("Failed to research specifications. Please try again.");
        } finally {
            setIsResearching(false);
        }
    };

    const handleResearchAirHandlerSpecs = async () => {
        if (!airHandlerDetails?.model) {
            showToast.error("Air Handler Model Number is required to research specifications.");
            return;
        }

        setIsResearchingAirHandler(true);
        try {
            const fns = getFunctions();
            const callGeminiAI = httpsCallable(fns, 'callGeminiAI');

            const brand = airHandlerDetails.brand || 'Unknown Brand';
            const model = airHandlerDetails.model;
            const serial = airHandlerDetails.serial || '';

            const prompt = `Senior HVAC & Appliance Technical Advisor.
Research and decode technical specs for this Air Handler / Fan Coil unit:
- Manufacturer/Brand: \${brand}
- Model Number: \${model}
- Serial Number: \${serial}

Your task is to decode the model/serial numbers or look up standard specs to fill out the following properties:
1. "year": Decode the manufacturing year from the serial number format (e.g., first 2 or 4 digits, or letter date code depending on brand). E.g. "2018".
2. "tonnage": Decode capacity/tonnage from model number BTUs (e.g. 024 = 2 tons, 036 = 3 tons, 042 = 3.5 tons, 048 = 4 tons, 060 = 5 tons). Return a number.
3. "refrigerantType": E.g. "R410A", "R22", "R134a", "R404A".
4. "heatType": E.g. "Electric", "Gas", "Heat Pump", "N/A".
5. "seerRating": Standard SEER rating for this model series (e.g. "14", "16", "21").
6. "electricityType": E.g. "230V / 1ph", "460V / 3ph", "115V / 1ph".
7. "filterType": Standard filter dimensions and type if it's a standard cabinet size (e.g., "20x25x1 MERV 11").

CRITICAL SAFETY RULES:
- DO NOT make up, guess, or hallucinate any information.
- Only return a value for a property if it is GUARANTEED or highly confident based on standard brand coding structures or verified manufacturer documentation.
- If a property cannot be confidently verified, set its value to null (do NOT make up placeholder values, guess years, or guess SEER ratings).
- If the serial number is blank or does not conform to date coding, set "year" to null.
- If the model is unrecognized or fake, set all spec fields to null.

Return ONLY a valid JSON object matching this schema with NO markdown wrapper:
{
  "year": string | null,
  "tonnage": number | null,
  "refrigerantType": string | null,
  "heatType": string | null,
  "seerRating": string | null,
  "electricityType": string | null,
  "filterType": string | null
}`;

            const result: any = await callGeminiAI({
                prompt,
                modelName: 'gemini-3.6-flash',
                config: { response_mime_type: 'application/json' }
            });

            const cleanJson = (result.data?.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const specs = JSON.parse(cleanJson);

            const hasSpecs = Object.values(specs).some(val => val !== null && val !== undefined && val !== '');

            if (!hasSpecs) {
                showToast.warn("No verified specifications could be confidently determined for this model/serial.");
                setIsResearchingAirHandler(false);
                return;
            }

            const updatedDetails = { ...airHandlerDetails };
            let count = 0;

            if (specs.year && !updatedDetails.year) {
                updatedDetails.year = specs.year;
                count++;
            }
            if (specs.tonnage && (updatedDetails.tonnage === undefined || updatedDetails.tonnage === null)) {
                updatedDetails.tonnage = Number(specs.tonnage);
                count++;
            }
            if (specs.refrigerantType && !updatedDetails.refrigerantType) {
                updatedDetails.refrigerantType = specs.refrigerantType;
                count++;
            }
            if (specs.heatType && !updatedDetails.heatType) {
                updatedDetails.heatType = specs.heatType;
                count++;
            }
            if (specs.electricityType && !updatedDetails.electricityType) {
                updatedDetails.electricityType = specs.electricityType;
                count++;
            }
            if (specs.seerRating && !updatedDetails.seerRating) {
                updatedDetails.seerRating = specs.seerRating;
                count++;
            }
            if (specs.filterType && !updatedDetails.filterType) {
                updatedDetails.filterType = specs.filterType;
                count++;
            }

            setAirHandlerDetails(updatedDetails);
            if (count > 0) {
                showToast.success(`Successfully populated \${count} technical specifications for the Air Handler!`);
            } else {
                showToast.info("AI lookup completed, but no new details were added.");
            }
        } catch (error) {
            console.error(error);
            showToast.error("Failed to research Air Handler specifications.");
        } finally {
            setIsResearchingAirHandler(false);
        }
    };

    const handleAddAsset = async (assetData?: Partial<EquipmentAsset>) => {
        const activeAsset = assetData || newAsset;
        if (!activeAsset.brand || !activeAsset.model) {
            showToast.warn("Brand and Model are required.");
            return;
        }
        const customer = state.customers.find(c => c.id === job.customerId);
        if (customer) {
            // Determine the current property ID to attach to the new asset
            const jobAddressStr = typeof job.address === 'string' ? job.address : '';
            let currentPropertyId = job.locationId;
            
            if (!currentPropertyId && jobAddressStr && customer?.serviceLocations) {
                const matchingLoc = customer.serviceLocations.find(loc => loc.address === jobAddressStr);
                if (matchingLoc) currentPropertyId = matchingLoc.id;
            }

            let updatedEquipment;
            let rtuId = activeAsset.id || `asset-${Date.now()}`;
            let rtuEq: EquipmentAsset;

            const baseAsset = {
                ...activeAsset,
                id: rtuId,
                propertyId: activeAsset.propertyId || currentPropertyId || undefined
            } as EquipmentAsset;

            if (activeAsset.id) {
                rtuEq = { ...baseAsset };
                updatedEquipment = (customer.equipment || []).map(e => e.id === activeAsset.id ? rtuEq : e);
            } else {
                rtuEq = { ...baseAsset };
                updatedEquipment = [...(customer.equipment || []), rtuEq];
            }

            let thermostatId: string | null = null;
            if (autoCreateThermostat) {
                thermostatId = `eq-${Date.now() + 1}`;
                const thermostatEq: EquipmentAsset = {
                    id: thermostatId,
                    organizationId: customer.organizationId || state.currentOrganization?.id || '',
                    customerId: customer.id,
                    name: thermostatDetails.name || 'Thermostat',
                    brand: thermostatDetails.brand || rtuEq.brand || '',
                    model: thermostatDetails.model || '',
                    serial: '',
                    type: 'Other',
                    propertyId: thermostatDetails.propertyId || rtuEq.propertyId || '',
                    physicalLocation: thermostatDetails.physicalLocation || 'Interior Wall',
                    exactPlacement: thermostatDetails.exactPlacement || '',
                    servesArea: thermostatDetails.servesArea || rtuEq.servesArea || '',
                    linkedAssetIds: [rtuId]
                } as EquipmentAsset;

                // Link RTU to Thermostat
                rtuEq.linkedAssetIds = [...(rtuEq.linkedAssetIds || []), thermostatId];
                updatedEquipment = updatedEquipment.map(e => e.id === rtuId ? rtuEq : e);
                updatedEquipment.push(thermostatEq);
            }

            if (autoCreateAirHandler) {
                const airHandlerId = `eq-${Date.now() + 2}`;
                const airHandlerEq: EquipmentAsset = {
                    id: airHandlerId,
                    organizationId: customer.organizationId || state.currentOrganization?.id || '',
                    customerId: customer.id,
                    name: airHandlerDetails.name || 'Air Handler',
                    brand: airHandlerDetails.brand || rtuEq.brand || '',
                    model: airHandlerDetails.model || '',
                    serial: airHandlerDetails.serial || '',
                    type: 'Air Handler',
                    propertyId: airHandlerDetails.propertyId || rtuEq.propertyId || '',
                    physicalLocation: airHandlerDetails.physicalLocation || 'Interior Closet',
                    exactPlacement: airHandlerDetails.exactPlacement || '',
                    servesArea: airHandlerDetails.servesArea || rtuEq.servesArea || '',
                    year: airHandlerDetails.year || undefined,
                    tonnage: airHandlerDetails.tonnage || undefined,
                    refrigerantType: airHandlerDetails.refrigerantType || undefined,
                    heatType: airHandlerDetails.heatType || undefined,
                    electricityType: airHandlerDetails.electricityType || undefined,
                    seerRating: airHandlerDetails.seerRating || undefined,
                    filterType: airHandlerDetails.filterType || undefined,
                    linkedAssetIds: [rtuId]
                } as EquipmentAsset;

                // Link RTU to Air Handler
                rtuEq.linkedAssetIds = [...(rtuEq.linkedAssetIds || []), airHandlerId];
                updatedEquipment = updatedEquipment.map(e => e.id === rtuId ? rtuEq : e);

                // Cross-link Thermostat to Air Handler if both are created
                if (autoCreateThermostat && thermostatId) {
                    airHandlerEq.linkedAssetIds = [...(airHandlerEq.linkedAssetIds || []), thermostatId];
                    updatedEquipment = updatedEquipment.map(e => {
                        if (e.id === thermostatId) {
                            return { ...e, linkedAssetIds: [...(e.linkedAssetIds || []), airHandlerId] };
                        }
                        return e;
                    });
                }

                updatedEquipment.push(airHandlerEq);
            }
            
            // Clean any undefined properties to prevent Firestore serialization errors
            const cleanedEquipment = JSON.parse(JSON.stringify(updatedEquipment));
            
            if (state.isDemoMode) {
                 console.log("Demo Mode: Skipping customer update.");
            } else {
                 await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ equipment: cleanedEquipment }));
            }
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, equipment: cleanedEquipment } });
        }
        setIsAddAssetOpen(false);
        setNewAsset({ brand: '', model: '', serial: '', type: 'System' });
        showToast.success("Asset saved!");
    };

    const handleDeleteAsset = async (id: string) => {
        if (!await globalConfirm("Delete this asset permanently?")) return;
        const customer = state.customers.find(c => c.id === job.customerId);
        if (customer) {
            const updatedEquipment = (customer.equipment || []).filter(e => e.id !== id);
            if (!state.isDemoMode) {
                await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ equipment: updatedEquipment }));
            }
            dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: customer.id, equipment: updatedEquipment } });
            showToast.success("Asset deleted.");
        }
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
        if (workflowState.repairPostponed) {
            if (!workflowState.workNotes?.trim()) missingItems.push('Explanation/Notes for Repair Postponement');
        } else {
            if (!workflowState.workNotes?.trim()) missingItems.push('Work Notes (Repair)');
            if (!(workflowState as any).partsUsed || (workflowState as any).partsUsed.length === 0) missingItems.push('Parts & Materials Log');
        }

        // Step 4 check
        if (workflowState.qualityChecklist?.length > 0 && workflowState.qualityChecklist.some(i => !i.completed)) missingItems.push('Quality QC Checklist Items');
        if (!workflowState.completionNotes?.trim()) missingItems.push('Completion Notes');

        if (missingItems.length > 0) {
            const msg = `Are you sure you meant to skip these?\n\n- ${missingItems.join('\n- ')}`;
            if (!await globalConfirm(msg, 'Incomplete Job Workflow', 'Close Job', 'Go Back')) return;
        } else {
            const confirmMsg = workflowState.repairPostponed 
                ? 'Depart site and mark repair as postponed?' 
                : 'Mark job as completed and depart site?';
            const confirmTitle = workflowState.repairPostponed ? 'Postpone Repair & Depart' : 'Complete Job';
            if (!await globalConfirm(confirmMsg, confirmTitle, 'Confirm', 'Cancel')) return;
        }

        await saveCurrentState();
        
        const nowStr = new Date().toISOString();
        let checkIn = job.checkInTime || nowStr;
        let checkOut = nowStr;
        
        const updatedEntries = [...(job.timeEntries || [])];
        let durationMins = job.timeOnSiteMinutes || 0;

        // If currently checked in, complete the active shift/entry
        if (job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime())) {
            const durationMs = new Date(nowStr).getTime() - new Date(checkIn).getTime();
            const currentMins = Math.max(0, Math.round(durationMs / 60000));
            
            if (updatedEntries.length > 0) {
                const lastIdx = updatedEntries.length - 1;
                updatedEntries[lastIdx] = {
                    ...updatedEntries[lastIdx],
                    checkOutTime: nowStr,
                    timeOnSiteMinutes: currentMins
                };
            } else {
                updatedEntries.push({
                    checkInTime: checkIn,
                    checkOutTime: nowStr,
                    timeOnSiteMinutes: currentMins
                });
            }
            durationMins = updatedEntries.reduce((acc, entry) => acc + (entry.timeOnSiteMinutes || 0), 0);
        } else {
            checkOut = job.checkOutTime || nowStr;
        }

        const checkoutUpdates: any = {
            jobStatus: (workflowState.repairPostponed ? 'Needs Follow-up' : 'Completed') as any,
            endTime: nowStr,
            checkOutTime: checkOut,
            timeOnSiteMinutes: durationMins,
            timeEntries: updatedEntries,
            repairPostponed: workflowState.repairPostponed || false,
            repairPostponedReason: workflowState.repairPostponedReason || ''
        };
        if (!job.checkInTime) {
            checkoutUpdates.checkInTime = checkIn;
        }

        // Lookup Subcontractor. Subcontractors are stored in the job owner's sub collection.
        const subcontractorId = job.assignedPartnerId || job.assignedTechnicianId;
        const subcontractor = state.subcontractors.find(s => s.id === subcontractorId || s.linkedOrgId === subcontractorId);

        if (subcontractor) {
            await handleJobUpdate(checkoutUpdates);
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
            await handleJobUpdate(checkoutUpdates);
            onClose();
        }
    };

    const handleCompleteDiagnosticOnly = async () => {
        const missingItems: string[] = [];
        
        // Step 1 check
        if (!workflowState.arrivalNotes?.trim()) missingItems.push('Arrival Notes');
        if (!assets || assets.length === 0) missingItems.push('Serviced Equipment / Assets');

        // Step 2 check
        if (!workflowState.diagnosisNotes?.trim()) missingItems.push('Diagnosis Notes');
        if (workflowState.diagnosisChecklist?.length > 0 && workflowState.diagnosisChecklist.some(i => !i.completed)) missingItems.push('Diagnosis Checklist Items');
        if (!workflowState.toolReadings || workflowState.toolReadings.length === 0) missingItems.push('Diagnostic Tool Readings');
        if (!files || files.length === 0) missingItems.push('Job Photos');
        
        const hasProposal = state.proposals?.some(p => p.jobId === job.id);
        if (!hasProposal) {
            missingItems.push('Linked Proposals');
        }

        if (missingItems.length > 0) {
            const msg = `You are skipping/missing some diagnostic items:\n\n- ${missingItems.join('\n- ')}\n\nAre you sure you want to complete the diagnostic job?`;
            if (!await globalConfirm(msg, 'Incomplete Diagnostic Workflow', 'Complete Diagnostic', 'Go Back')) return;
        } else {
            if (!await globalConfirm('Mark diagnostic job as completed? This will skip the Repair, Quality, and Billing steps.', 'Complete Diagnostic', 'Confirm', 'Cancel')) return;
        }

        await saveCurrentState();

        const nowStr = new Date().toISOString();
        const checkIn = job.checkInTime || nowStr;
        const checkOut = job.checkOutTime || nowStr;
        const durationMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
        const durationMins = job.timeOnSiteMinutes !== undefined ? job.timeOnSiteMinutes : Math.round(durationMs / 60000);

        const updates: any = { 
            jobStatus: 'Completed' as const, 
            endTime: nowStr,
            checkOutTime: checkOut,
            timeOnSiteMinutes: durationMins,
            isDiagnosticOnly: true 
        };
        if (!job.checkInTime) {
            updates.checkInTime = checkIn;
        }

        const subcontractorId = job.assignedPartnerId || job.assignedTechnicianId;
        const subcontractor = state.subcontractors.find(s => s.id === subcontractorId || s.linkedOrgId === subcontractorId);

        if (subcontractor) {
            await handleJobUpdate(updates);
            if (subcontractor.paymentType === 'percentage') {
                const invoiceTotal = job.invoice?.totalAmount || job.invoice?.amount || 0;
                const percentage = subcontractor.paymentPercentage || 0;
                const amount = (invoiceTotal * percentage) / 100;
                await createPayable(subcontractor, amount);
                
                const confirmFollowUp = await globalConfirm(
                    "Would you like to schedule and link a return repair visit for this customer now?",
                    "Schedule Return Visit",
                    "Yes, Schedule Now",
                    "No, Close Job"
                );
                showToast.success("Diagnostic job completed successfully!");
                if (confirmFollowUp) {
                    setIsScheduleFollowUpOpen(true);
                } else {
                    onClose();
                }
            } else {
                setIsPayableModalOpen(true);
            }
        } else {
            await handleJobUpdate(updates);
            
            const confirmFollowUp = await globalConfirm(
                "Would you like to schedule and link a return repair visit for this customer now?",
                "Schedule Return Visit",
                "Yes, Schedule Now",
                "No, Close Job"
            );
            showToast.success("Diagnostic job completed successfully!");
            if (confirmFollowUp) {
                setIsScheduleFollowUpOpen(true);
            } else {
                onClose();
            }
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
        await db.collection('payables').doc(payable.id).set(cleanUndefinedFields(payable));
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
    
    const normalizeRefType = (type: string) => {
        if (!type) return '';
        return type.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    };

    const handleAddRefrigerant = async () => {
        if (!refrigerantEntry.amount) return;
        
        let cylinderName = refrigerantEntry.cylinderNumber === 'CUSTOM' ? customCylString : refrigerantEntry.cylinderNumber;
        
        // Sync with live refrigerantCylinders if a known cylinder was selected
        if (refrigerantEntry.cylinderNumber && refrigerantEntry.cylinderNumber !== 'CUSTOM' && !state.isDemoMode) {
            try {
                const cylinder = state.refrigerantCylinders?.find(c => {
                    const matchesCyl = c.id === refrigerantEntry.cylinderNumber;
                    if (!matchesCyl) return false;
                    return normalizeRefType(c.type) === normalizeRefType(refrigerantEntry.type);
                });
                if (cylinder) {
                    cylinderName = cylinder.tag || cylinder.type; // Use human readable name for the log entry
                    
                    let amountUsed = Number(refrigerantEntry.amount);
                    if (refrigerantEntry.unit === 'oz') amountUsed = amountUsed / 16;
                    else if (refrigerantEntry.unit === 'kg') amountUsed = amountUsed * 2.20462;
                    
                    // Added means used FROM the cylinder, so we subtract relative to the cylinder stock
                    // Recovered means put INTO the recovery cylinder, so we add relative to the cylinder stock
                    const currentWt = Number((cylinder as any).currentWeight || 0);
                    const tareWt = Number((cylinder as any).tareWeight || 0);
                    const newQty = refrigerantEntry.action === 'Added' ? (currentWt - amountUsed) : (currentWt + amountUsed);
                    
                    await db.collection('refrigerantCylinders').doc(cylinder.id).update(cleanUndefinedFields({
                        currentWeight: Math.max(tareWt, newQty), // Disallow dropping below tare weight
                        remainingWeight: Math.max(0, newQty - tareWt)
                    }));
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
            inventoryItemId: selectedPart.id, // Store target document ID for exact synchronization
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
                    await db.collection('inventory').doc(newInventoryId).set(cleanUndefinedFields(newInventoryItem));
                    entry.sku = newInventoryId; // Use the DB identifier natively moving forward
                    entry.inventoryItemId = newInventoryId; // Set the inventory ID for custom item as well
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
                if (!state.isDemoMode) await db.collection('expenses').doc(expense.id).set(cleanUndefinedFields(expense));
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
                    await db.collection('expenses').doc(expenseToAttach.id).update(cleanUndefinedFields({
                        projectId: job.id
                    }));
                }

                // Automatically deduct stock quantity from global inventory
                if (!state.isDemoMode) {
                    const invItemRef = db.collection('inventory').doc(selectedPart.id);
                    const invDoc = await invItemRef.get();
                    if (invDoc.exists) {
                        const currentQty = Number(invDoc.data()?.quantity || 0);
                        await invItemRef.update(cleanUndefinedFields({
                            quantity: Math.max(0, currentQty - partQuantity)
                        }));
                    }
                }
            } catch(e) {
                console.error("Failed to link inventory expense and deduct stock:", e);
            }
        }
        
        setIsPartModalOpen(false);
        setSelectedPart(null);
        setPartQuantity(1);
        setPartPaymentMethod('inventory');
        setPartReceipt(null);
    };

    const handleOpenToolReadingModal = () => {
        setNewReading({
            id: `tool-${Date.now()}`,
            toolType: '',
            summary: '',
            phase: 'before',
            assetId: '',
            reportUrl: ''
        });
        setIsUploadingDiagnostic(false);
        setUploadedDiagnosticName('');
        setIsToolReadingModalOpen(true);
    };

    const handleDiagnosticFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const file = files[0];
        
        setIsUploadingDiagnostic(true);
        try {
            const orgId = job.organizationId;
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'diagnostic.jpg';
            const path = `organizations/${orgId}/jobs/${job.id}/diagnostics/${Date.now()}_${safeName}`;
            
            let downloadUrl;
            if (state.isDemoMode) {
                downloadUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
                    reader.readAsDataURL(file);
                });
            } else {
                downloadUrl = await uploadFileToStorage(path, file);
            }
            
            setNewReading(prev => ({ ...prev, reportUrl: downloadUrl }));
            setUploadedDiagnosticName(file.name || 'diagnostic.jpg');
            showToast.success("Diagnostic file uploaded successfully!");
            
            // Also save this file to job.files so it's globally associated with the job's files list
            const newFileId = `file-${Date.now()}`;
            const timestamp = new Date().toISOString();
            const userName = `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Technician';
            
            const flatFile = {
                id: String(newFileId),
                organizationId: String(job.organizationId),
                parentId: String(job.id),
                parentType: 'job',
                fileName: String(file.name || 'diagnostic.jpg'),
                fileType: String(file.type || 'image/jpeg'),
                dataUrl: String(downloadUrl),
                createdAt: String(timestamp),
                uploadedBy: String(userName),
                label: 'Diagnostic Reading',
                metadata: {
                    readingId: String(newReading.id || `tool-${Date.now()}`),
                    assetId: String(newReading.assetId || '')
                }
            };
            
            if (state.isDemoMode) {
                addFilesToJob([flatFile as any]);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: firebase.firestore.FieldValue.arrayUnion(flatFile),
                    updatedAt: timestamp
                }));
                addFilesToJob([flatFile as any]);
            }
        } catch (error) {
            console.error("Diagnostic upload failed:", error);
            showToast.error("Failed to upload diagnostic file.");
        } finally {
            setIsUploadingDiagnostic(false);
        }
    };

    const handleAddReading = () => {
        if (!newReading.toolType || !newReading.summary) return;
        const reading = { 
            ...newReading, 
            id: newReading.id || `tool-${Date.now()}`, 
            date: new Date().toISOString(), 
            phase: newReading.phase || 'before', 
            assetId: newReading.assetId || '' 
        };
        updateWorkflowState('toolReadings', [...workflowState.toolReadings, reading]);
        setNewReading({ id: '', toolType: '', summary: '', phase: 'before', assetId: '', reportUrl: '' });
        setUploadedDiagnosticName('');
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

    const checkAllItems = (list: keyof WorkflowState) => {
        const currentList = workflowState[list] as ChecklistItem[];
        const newList = currentList.map(item => ({ ...item, completed: true }));
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

    const handleNativeAssetCameraTrigger = async (photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl') => {
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
                    
                    const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    await handleAssetPhotoUpload(mockEvent, photoType);
                }
            } else {
                setAssetCameraTarget(photoType);
                setIsWebCameraOpen(true);
            }
        } catch (e: any) {
            console.error("Camera error:", e);
            setAssetCameraTarget(photoType);
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
                addFilesToJob([flatFile as any]);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: firebase.firestore.FieldValue.arrayUnion(flatFile),
                    updatedAt: timestamp
                }));
                addFilesToJob([flatFile as any]);
            }
        } catch (error) {
            console.error("Photo process failed:", error);
            showToast.error("Failed to save photo.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, label: string) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        for (const file of files) {
            await processCapturedFile(file, label);
        }
    };

    const handleDeletePhoto = async (fileToDelete: StoredFile) => {
        if (!window.confirm("Delete this photo?")) return;
        
        setIsSaving(true);
        try {
            if (state.isDemoMode) {
                removeFileFromJob(fileToDelete);
            } else {
                // Nuclear delete: Use arrayRemove to ensure it's removed from the array field
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: firebase.firestore.FieldValue.arrayRemove(fileToDelete)
                }));
                removeFileFromJob(fileToDelete);
            }
        } catch (e) {
            console.error("Delete failed:", e);
            showToast.error("Failed to delete photo. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssignPhotoToAsset = async (fileId: string, assetId: string) => {
        setIsSaving(true);
        try {
            const updatedFiles = files.map(f => {
                if (f.id === fileId) {
                    return {
                        ...f,
                        metadata: {
                            ...(f.metadata || {}),
                            assetId: assetId || undefined
                        }
                    };
                }
                return f;
            });

            if (state.isDemoMode) {
                setFiles(updatedFiles);
                onUpdate({ ...job, files: updatedFiles } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));
                setFiles(updatedFiles);
                onUpdate({ ...job, files: updatedFiles } as any);
            }
            showToast.success(assetId ? "Photo linked to unit!" : "Photo set to general job photo.");
        } catch (err) {
            console.error("Failed to assign photo to asset:", err);
            showToast.error("Failed to link photo to unit.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdatePhotoLabel = async (fileId: string, label: string) => {
        setIsSaving(true);
        try {
            const updatedFiles = files.map(f => {
                if (f.id === fileId) {
                    return {
                        ...f,
                        label: label,
                        metadata: {
                            ...(f.metadata || {}),
                            label: label
                        }
                    };
                }
                return f;
            });

            if (state.isDemoMode) {
                setFiles(updatedFiles);
                onUpdate({ ...job, files: updatedFiles } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));
                setFiles(updatedFiles);
                onUpdate({ ...job, files: updatedFiles } as any);
            }
            showToast.success("Photo label updated!");
        } catch (err) {
            console.error("Failed to update photo label:", err);
            showToast.error("Failed to update photo label.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSignOff = async (signOffFile: StoredFile) => {
        const updatedFiles = [...files, signOffFile];
        setIsSaving(true);
        try {
            if (state.isDemoMode) {
                setFiles(updatedFiles);
                onUpdate({ ...job, files: updatedFiles } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: new Date().toISOString()
                }));
                setFiles(updatedFiles);
                onUpdate({ ...job, files: updatedFiles } as any);
            }
        } catch (err) {
            console.error("Failed to save sign-off sheet:", err);
            showToast.error("Failed to save sign-off sheet.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteWorkflowFile = async (fileId: string) => {
        const fileToDelete = files.find(f => f.id === fileId);
        if (!fileToDelete) return;
        
        const isSignOff = fileToDelete.fileName === 'SignOff_Sheet.html' || fileToDelete.metadata?.label === 'Sign-Off Sheet';
        const confirmMsg = isSignOff 
            ? t("Are you sure you want to remove this signed validation sheet? You will need to regenerate and collect the signature again if required.")
            : t("Are you sure you want to remove this document?");
            
        const confirmDelete = await globalConfirm(
            confirmMsg,
            isSignOff ? t("Remove Sign-Off Sheet") : t("Remove Document"),
            t("Remove"),
            t("Cancel")
        );
        if (!confirmDelete) return;

        setIsSaving(true);
        try {
            if (state.isDemoMode) {
                removeFileFromJob(fileToDelete);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: firebase.firestore.FieldValue.arrayRemove(fileToDelete),
                    updatedAt: new Date().toISOString()
                }));
                removeFileFromJob(fileToDelete);
            }
            showToast.success(t("Document removed."));
        } catch (e) {
            console.error("Delete failed:", e);
            showToast.error(t("Failed to delete document."));
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
            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping proposal update.");
            } else {
                await db.collection('proposals').doc(proposalId).update(cleanUndefinedFields({ 
                    jobId: job.id,
                    poNumber: job.poNumber || null
                }));
            }
        } catch (e) { console.error("Warning: Could not formally link proposal to jobId.", e); }

        dispatch({
            type: 'UPDATE_PROPOSAL',
            payload: { id: proposalId, jobId: job.id, poNumber: job.poNumber || null }
        });

        // Link the proposal to the job itself so that the invoice editor knows about the linked proposal
        await handleJobUpdate({ proposalId: proposalId });

        await saveCurrentState();
        dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: job.id });
        
        const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
        let basePath = isStaff ? '/admin' : '/briefing';
        // Force the app to stay in the technician portal context if they are currently inside it
        if (window.location.hash.includes('/briefing')) {
            basePath = '/briefing';
        }
        
        const proposal = state.proposals?.find(p => p.id === proposalId);
        if (proposal?.isProjectLevel) {
            if (isStaff) {
                navigate(`/admin/project-proposals?editId=${proposalId}`);
                onClose();
            } else {
                const activeDemoRole = sessionStorage.getItem('activeDemoRole');
                const demoQuery = state.isDemoMode && activeDemoRole ? `?demo=${activeDemoRole}` : '';
                window.open(`/${demoQuery}#/project-proposal-view/${proposalId}`, '_blank');
            }
            return;
        }
        
        navigate(`${basePath}/proposal?jobId=${job.id}&source=workflow&proposalId=${proposalId}`);
        onClose();
    };

    const handleUnlinkProposal = async (proposalId: string) => {
        try {
            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping proposal unlink.");
            } else {
                await db.collection('proposals').doc(proposalId).update(cleanUndefinedFields({ 
                    jobId: null,
                    invoiceId: null
                }));
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    proposalId: null
                }));
            }
            dispatch({
                type: 'UPDATE_PROPOSAL',
                payload: { id: proposalId, jobId: null, invoiceId: null }
            });
            dispatch({
                type: 'UPDATE_JOB',
                payload: { id: job.id, proposalId: null }
            });
            showToast.success("Proposal unlinked successfully!");
        } catch (e) {
            console.error("Failed to unlink proposal", e);
            showToast.error("Failed to unlink proposal.");
        }
    };

    const handleBuildProposal = async () => {
        await saveCurrentState();
        dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: job.id });
        
        const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
        let basePath = isStaff ? '/admin' : '/briefing';
        if (window.location.hash.includes('/briefing')) {
            basePath = '/briefing';
        }
        
        if (job.proposalId) {
            const continueExisting = await globalConfirm(
                t('A proposal has already been started for this job. Would you like to continue editing the existing proposal instead of creating a new one?'),
                t('Existing Proposal Found'),
                t('Edit Existing'),
                t('Create New Anyway')
            );
            if (continueExisting) {
                navigate(`${basePath}/proposal?jobId=${job.id}&source=workflow&proposalId=${job.proposalId}`);
                onClose();
                return;
            }
        }
        
        navigate(`${basePath}/proposal?jobId=${job.id}&source=workflow`);
        onClose();
    };

    const handleInvoiceClick = async () => {
        if (job.invoice && job.invoice.id) {
            const continueExisting = await globalConfirm(
                t('An invoice has already been started for this job. Would you like to continue editing the existing invoice instead of starting a new one?'),
                t('Existing Invoice Found'),
                t('Edit Existing'),
                t('Start New')
            );
            if (!continueExisting) {
                const orgId = job.organizationId || state.currentOrganization?.id;
                if (orgId) {
                    try {
                        const nextInvId = await getNextInvoiceNumber(orgId);
                        const clearedInvoice = {
                            id: nextInvId,
                            status: 'Unpaid',
                            items: [],
                            subtotal: 0,
                            taxRate: (state.currentOrganization?.taxRate || 8.25) / 100,
                            taxAmount: 0,
                            totalAmount: 0,
                            amount: 0
                        };
                        await handleJobUpdate({ invoice: clearedInvoice });
                    } catch (err) {
                        console.error("Failed to reset invoice:", err);
                    }
                }
            }
        }
        setIsInvoiceEditorOpen(true);
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
                    {job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime()) && (
                        <Button 
                            variant="secondary" 
                            onClick={handleStopClock} 
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:border-red-900 text-xs font-black uppercase tracking-wider h-10 px-4 rounded-xl flex items-center gap-2 shrink-0 shadow-sm"
                        >
                            <Clock size={14} className="animate-pulse" />
                            {t("Stop Clock")}
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => setIsAssistantOpen(true)} className="hidden md:flex relative !p-2 shrink-0">
                         <Sparkles size={18} className="text-primary-500"/>
                    </Button>
                </div>
            </div>

            <div className="flex justify-center items-center py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0 sticky top-0 z-20">
                <div className="relative w-full max-w-4xl px-2 sm:px-4 mx-auto overflow-x-auto no-scrollbar">
                    <div className="flex justify-between items-center relative z-10 w-full min-w-[320px] gap-1 sm:gap-2">
                        {['arrival', 'diagnosis', 'repair', 'quality', 'billing'].filter(s => activeSteps.includes(s) || s === 'arrival' || s === 'quality' || s === 'billing').map((s) => {
                            const labels: Record<string, string> = { arrival: 'Arrive', diagnosis: 'Diagnose', repair: 'Repair', quality: 'Quality', billing: 'Bill' };
                            return (
                                <button key={s} onClick={() => scrollToSection(s)} className="flex-1 flex flex-col items-center justify-center gap-1 group cursor-pointer border-none bg-transparent outline-none min-h-[44px] py-1 px-1 touch-manipulation active:scale-95">
                                    <div className={`w-full h-1.5 rounded-full transition-all mb-0.5 ${expandedSections[s] ? 'bg-primary-500 shadow-sm' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-primary-300'}`} />
                                    <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-tight text-center truncate ${expandedSections[s] ? 'text-primary-700 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-primary-500'}`}>
                                        {t(labels[s])}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 md:p-6 custom-scrollbar pb-32">
                {parentJob && (
                    <div className="mb-6 p-5 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-r-2xl shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                            <span>🔗</span>
                            <span>{t("Continuation of Job")} #{parentJob.id.slice(-6).toUpperCase()}</span>
                            {parentJob.repairPostponedReason && (
                                <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-850 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {parentJob.repairPostponedReason}
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-3">
                            {parentJob.notes?.diagnosis && (
                                <div>
                                    <strong className="text-slate-800 dark:text-slate-200">{t("Previous Diagnosis Notes:")}</strong>
                                    <p className="mt-1 whitespace-pre-wrap bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-850/60 font-mono text-[11px] leading-relaxed">{parentJob.notes.diagnosis}</p>
                                </div>
                            )}
                            {parentJob.notes?.workNotes && (
                                <div>
                                    <strong className="text-slate-800 dark:text-slate-200">{t("Previous Work Notes:")}</strong>
                                    <p className="mt-1 whitespace-pre-wrap bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-850/60 font-mono text-[11px] leading-relaxed">{parentJob.notes.workNotes}</p>
                                </div>
                            )}
                            {parentJob.files && parentJob.files.length > 0 && (
                                <div className="space-y-1.5">
                                    <strong className="text-slate-800 dark:text-slate-200">{t("Previous Photos/Attachments:")}</strong>
                                    <div className="flex gap-2 overflow-x-auto py-1 custom-scrollbar">
                                        {parentJob.files.map((file, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => setViewingPhoto(file)} 
                                                className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                            >
                                                <img src={file.dataUrl || file.url} alt={file.label || "Previous attachment"} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {/* Arrival */}
                    <div ref={sectionRefs.arrival} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button onClick={() => setExpandedSections(prev => ({...prev, arrival: !prev.arrival}))} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center justify-center font-bold">1</div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t("Arrival & Intake")}</h3>
                            </div>
                            <ChevronDown size={20} className={`text-slate-400 transition-transform ${expandedSections.arrival ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections.arrival && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
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
                                    handleDeleteAsset={handleDeleteAsset}
                                    isOcrScanning={isOcrScanning}
                                    handleAssetPhotoUpload={handleAssetPhotoUpload}
                                    saveCustomerInfo={saveCurrentState} 
                                    files={files}
                                    handlePhotoUpload={handlePhotoUpload}
                                    takeNativePhoto={() => handleNativeCameraTrigger('Before')}
                                    takeNativeAssetPhoto={handleNativeAssetCameraTrigger}
                                    onDeletePhoto={handleDeletePhoto}
                                    onViewPhoto={setViewingPhoto}
                                    onAssignPhotoToAsset={handleAssignPhotoToAsset}
                                    onUpdatePhotoLabel={handleUpdatePhotoLabel}
                                    checkInTime={job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime()) ? job.checkInTime : undefined}
                                    onCheckIn={handleCheckIn}
                                    onStartRoute={handleStartRoute}
                                    onJobUpdate={handleJobUpdate}
                                />
                            </div>
                        )}
                    </div>

                    {/* Diagnosis */}
                    {activeSteps.includes('diagnosis') && (
                    <div ref={sectionRefs.diagnosis} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button onClick={() => setExpandedSections(prev => ({...prev, diagnosis: !prev.diagnosis}))} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 flex items-center justify-center font-bold">2</div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t("Diagnosis")}</h3>
                            </div>
                            <ChevronDown size={20} className={`text-slate-400 transition-transform ${expandedSections.diagnosis ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections.diagnosis && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                                <DiagnosisStep 
                                    setIsWaiverOpen={setIsWaiverOpen} 
                                    setIsImportModalOpen={() => openImport('diagnosis')} 
                                    setIsToolModalOpen={handleOpenToolReadingModal}
                                    buildProposal={handleBuildProposal} 
                                    onOpenProposalSelector={() => setIsProposalSelectorOpen(true)}
                                    linkedProposals={state.proposals?.filter(p => p.jobId === job.id)}
                                    onViewEditProposal={handleViewEditProposal}
                                    onUnlinkProposal={handleUnlinkProposal}
                                    checklists={workflowState.diagnosisChecklist} 
                                    toggleChecklistItem={(id) => toggleChecklistItem('diagnosisChecklist', id)} 
                                    toggleChecklistVisibility={(id) => toggleChecklistVisibility('diagnosisChecklist', id)}
                                    toggleAllChecklistVisibility={(hideMode) => toggleAllChecklistVisibility('diagnosisChecklist', hideMode)}
                                    onCheckAll={() => checkAllItems('diagnosisChecklist')}
                                    notes={workflowState.diagnosisNotes} 
                                    setNotes={(val) => updateWorkflowState('diagnosisNotes', val)} 
                                    handlePhotoUpload={handlePhotoUpload} 
                                    takeNativePhoto={() => handleNativeCameraTrigger('Before')}
                                    files={files} 
                                    onDeletePhoto={handleDeletePhoto} 
                                    onViewPhoto={setViewingPhoto} 
                                    onUpdatePhotoLabel={handleUpdatePhotoLabel}
                                    toolReadings={workflowState.toolReadings}
                                    onDeleteToolReading={(id) => updateWorkflowState('toolReadings', workflowState.toolReadings.filter(r => r.id !== id))}
                                    onOpenIndustryTools={() => setIsIndustryToolsOpen(true)}
                                    assets={assets}
                                    unitStates={workflowState.unitStates || []}
                                    setUnitStates={(val) => updateWorkflowState('unitStates', val)}
                                    serviceLocations={customerObj?.serviceLocations || []}
                                    onAssignPhotoToAsset={handleAssignPhotoToAsset}
                                    onEditAsset={(asset) => { setNewAsset(asset); setIsAddAssetOpen(true); }}
                                />
                                {job.visitType === 'Diagnostic Only' && (
                                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-purple-900 dark:text-purple-300">{t("Proceeding to Repair?")}</h4>
                                            <p className="text-sm text-purple-700 dark:text-purple-400">{t("Upgrade this visit to include repair workflow steps.")}</p>
                                        </div>
                                        <Button onClick={handleUpgradeToRepair} className="bg-purple-600 hover:bg-purple-700 text-white font-bold whitespace-nowrap">
                                            {t("Upgrade to Repair Now")} <ArrowRight size={16} className="ml-1 inline" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    )}

                    {/* Repair */}
                    {activeSteps.includes('repair') && (
                    <div ref={sectionRefs.repair} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button onClick={() => setExpandedSections(prev => ({...prev, repair: !prev.repair}))} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex items-center justify-center font-bold">3</div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t("Repair & Execution")}</h3>
                            </div>
                            <ChevronDown size={20} className={`text-slate-400 transition-transform ${expandedSections.repair ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections.repair && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                                <RepairStep 
                                    setIsScannerOpen={setIsScannerOpen} 
                                    setIsLiveAssistOpen={setIsLiveAssistOpen} 
                                    setIsRefrigerantModalOpen={() => setIsRefrigerantModalOpen(true)}
                                    setIsPartModalOpen={() => setIsPartModalOpen(true)}
                                    workNotes={workflowState.workNotes} 
                                    setWorkNotes={(val) => updateWorkflowState('workNotes', val)} 
                                    handlePhotoUpload={handlePhotoUpload} 
                                    takeNativePhoto={() => handleNativeCameraTrigger('After')}
                                    files={files} 
                                    onDeletePhoto={handleDeletePhoto} 
                                    onViewPhoto={setViewingPhoto} 
                                    assets={assets}
                                    onAssignPhotoToAsset={handleAssignPhotoToAsset}
                                    onUpdatePhotoLabel={handleUpdatePhotoLabel}
                                    partsUsed={(workflowState as any).partsUsed || []}
                                    onRemovePart={async (idx) => {
                                        const newList = [...((workflowState as any).partsUsed || [])];
                                        const removedPart = newList[idx] as any;
                                        if (removedPart && removedPart.paymentMethod === 'inventory' && removedPart.inventoryItemId && removedPart.inventoryItemId !== 'custom' && !state.isDemoMode) {
                                            try {
                                                const invItemRef = db.collection('inventory').doc(removedPart.inventoryItemId);
                                                const invDoc = await invItemRef.get();
                                                if (invDoc.exists) {
                                                    const currentQty = Number(invDoc.data()?.quantity || 0);
                                                    await invItemRef.update(cleanUndefinedFields({
                                                        quantity: currentQty + Number(removedPart.quantity || 0)
                                                    }));
                                                }
                                            } catch (e) {
                                                console.error("Failed to restore inventory stock on removal:", e);
                                            }
                                        }
                                        newList.splice(idx, 1);
                                        updateWorkflowState('partsUsed' as any, newList as any);
                                    }}
                                    repairPostponed={workflowState.repairPostponed || false}
                                    setRepairPostponed={(val) => updateWorkflowState('repairPostponed', val)}
                                    repairPostponedReason={workflowState.repairPostponedReason || ''}
                                    setRepairPostponedReason={(val) => updateWorkflowState('repairPostponedReason', val)}
                                    setIsToolModalOpen={handleOpenToolReadingModal}
                                    toolReadings={workflowState.toolReadings}
                                    onDeleteToolReading={(id) => updateWorkflowState('toolReadings', workflowState.toolReadings.filter(r => r.id !== id))}
                                    unitStates={workflowState.unitStates || []}
                                    setUnitStates={(val) => updateWorkflowState('unitStates', val)}
                                    onEditAsset={(asset) => { setNewAsset(asset); setIsAddAssetOpen(true); }}
                                />
                            </div>
                        )}
                    </div>
                    )}

                    {/* Quality */}
                    <div ref={sectionRefs.quality} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button onClick={() => setExpandedSections(prev => ({...prev, quality: !prev.quality}))} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400 flex items-center justify-center font-bold">4</div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t("Quality & Feedback")}</h3>
                            </div>
                            <ChevronDown size={20} className={`text-slate-400 transition-transform ${expandedSections.quality ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections.quality && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                                <QualityStep 
                                    setIsImportModalOpen={() => openImport('quality')} 
                                    checklists={workflowState.qualityChecklist} 
                                    toggleChecklistItem={(id) => toggleChecklistItem('qualityChecklist', id)} 
                                    toggleChecklistVisibility={(id) => toggleChecklistVisibility('qualityChecklist', id)}
                                    toggleAllChecklistVisibility={(hideMode) => toggleAllChecklistVisibility('qualityChecklist', hideMode)}
                                    onCheckAll={() => checkAllItems('qualityChecklist')}
                                    completionNotes={workflowState.completionNotes} 
                                    setCompletionNotes={(val) => updateWorkflowState('completionNotes', val)} 
                                    customerFeedback={workflowState.customerFeedback} 
                                    setCustomerFeedback={(val) => updateWorkflowState('customerFeedback', val)} 
                                    membershipOffered={workflowState.membershipOffered || false} 
                                    setMembershipOffered={(val) => updateWorkflowState('membershipOffered', val)} 
                                    techRecommendations={workflowState.techRecommendations || ''}
                                    setTechRecommendations={(val) => updateWorkflowState('techRecommendations', val)}
                                    thankYouNote={workflowState.thankYouNote || ''}
                                    setThankYouNote={(val) => updateWorkflowState('thankYouNote', val)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Billing */}
                    <div ref={sectionRefs.billing} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button onClick={() => setExpandedSections(prev => ({...prev, billing: !prev.billing}))} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center justify-center font-bold">5</div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t("Billing & Sign-Off")}</h3>
                            </div>
                            <ChevronDown size={20} className={`text-slate-400 transition-transform ${expandedSections.billing ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections.billing && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                                <BillingStep 
                                    handleGoToPayments={handleInvoiceClick} 
                                    onOpenInvoiceSelector={() => setIsInvoiceSelectorOpen(true)} 
                                    onOpenSignOff={() => setIsSignOffOpen(true)} 
                                    files={files}
                                    onPreviewFile={(file) => {
                                        let content = file.dataUrl || '';
                                        if (content.startsWith('data:text/html;base64,')) {
                                            try {
                                                const base64Part = content.split('base64,')[1];
                                                content = decodeURIComponent(escape(atob(base64Part)));
                                            } catch (err) {
                                                console.error("Failed to decode base64 preview html:", err);
                                            }
                                        }
                                        setPreviewDoc({
                                            id: file.id,
                                            title: file.metadata?.label || "Sign-Off Sheet",
                                            htmlContent: content,
                                            ...file
                                        });
                                    }}
                                    onDeleteFile={handleDeleteWorkflowFile}
                                    onUploadFile={handlePhotoUpload}
                                    isSubcontractor={isSubcontractor || isSubcontractorJob}
                                    onOpenSubBill={() => setIsSubBillOpen(true)}
                                />
                                <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{t("Deferred Billing / Roll to Next Visit")}</h4>
                                    <p className="text-sm text-slate-500 mb-3">{t("If parts need to be ordered or a follow-up visit is required, you can defer this payment to a future scheduled job.")}</p>
                                    <div className="flex gap-2">
                                        <select 
                                            id="rollPaymentTarget"
                                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
                                            defaultValue=""
                                        >
                                            <option value="" disabled>{t("Select Job or Create New...")}</option>
                                            <option value="new">{t("+ Create New Follow-up Job")}</option>
                                            {state.jobs.filter(j => j.customerId === job.customerId && j.id !== job.id && j.jobStatus !== 'Completed').map(j => (
                                                <option key={j.id} value={j.id}>{t("Job")} #{j.id.slice(-6).toUpperCase()} - {j.appointmentTime ? new Date(j.appointmentTime).toLocaleDateString() : t("Unscheduled")}</option>
                                            ))}
                                        </select>
                                        <Button 
                                            onClick={() => {
                                                const selectEl = document.getElementById('rollPaymentTarget') as HTMLSelectElement;
                                                if (selectEl.value === 'new') {
                                                    setShouldRollChargesAfterScheduling(true);
                                                    setIsAppointmentModalOpen(true);
                                                } else if (selectEl.value) {
                                                    handleRollPaymentToJob(selectEl.value);
                                                }
                                            }}
                                            className="whitespace-nowrap"
                                        >
                                            {t("Roll Forward")}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full shrink-0 z-30 p-3 sm:p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                    {!job.transitStartTime ? (
                        <button 
                            type="button"
                            onClick={handleStartRoute}
                            disabled={isSaving}
                            className="w-full min-h-[48px] py-3 px-4 rounded-xl text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white shadow-md transition-all touch-manipulation cursor-pointer"
                        >
                            <Navigation size={20} className="animate-bounce" />
                            <span>{t("Start Route (En Route)")}</span>
                        </button>
                    ) : (job.transitStartTime && (!job.checkInTime || new Date(job.checkInTime).getTime() <= new Date(job.transitStartTime).getTime())) ? (
                        <button 
                            type="button"
                            onClick={handleCheckIn}
                            disabled={isSaving}
                            className="w-full min-h-[48px] py-3 px-4 rounded-xl text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-md transition-all touch-manipulation cursor-pointer"
                        >
                            <MapPin size={20} className="animate-pulse" />
                            <span>{t("Check In at Job Site")}</span>
                        </button>
                    ) : (
                        <Button 
                            onClick={() => {
                                const invalidSection = validateBeforeComplete();
                                if (invalidSection) {
                                    showToast.warn("Please complete required notes before continuing.");
                                    scrollToSection(invalidSection);
                                    return;
                                }
                                handleLeaveSite();
                            }} 
                            disabled={isSaving} 
                            data-tour="tech-workflow-complete-btn" 
                            className="w-full min-h-[48px] py-3.5 text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 !bg-emerald-600 hover:!bg-emerald-700 active:scale-[0.98] !text-white shadow-md transition-all touch-manipulation cursor-pointer rounded-xl"
                        >
                            {isSaving ? t("Saving...") : (job.visitType === 'Diagnostic Only' ? t("Complete Diagnostic Only") : t("Complete Job & Sign Off"))} <Check size={20}/>
                        </Button>
                    )}
                </div>
            </div>

        </div>

        {/* Appointment Modal for Next Visit */}
        {isAppointmentModalOpen && (
            <JobAppointmentModal 
                isOpen={isAppointmentModalOpen}
                onClose={() => setIsAppointmentModalOpen(false)}
                parentJobToLink={job}
            />
        )}

        {/* Proposal Selector Modal */}
        <Modal isOpen={isProposalSelectorOpen} onClose={() => setIsProposalSelectorOpen(false)} title={t("Select Existing Proposal")}>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                <p className="text-sm text-slate-500 mb-4">{t("Select an existing proposal for this customer to import into the workflow.")}</p>
                {(!state.proposals || state.proposals.filter(p => p.jobId === job.id || (job.customerId && p.customerId === job.customerId) || (p.customerName && job.customerName && p.customerName.toLowerCase() === job.customerName.toLowerCase())).length === 0) && (
                    <div className="text-center p-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed">{t("No existing proposals found for this customer.")}</div>
                )}
                {state.proposals?.filter(p => p.jobId === job.id || (job.customerId && p.customerId === job.customerId) || (p.customerName && job.customerName && p.customerName.toLowerCase() === job.customerName.toLowerCase()))
                    .sort((a,b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime())
                    .map(proposal => (
                    <button type="button" key={proposal.id} onClick={() => { setIsProposalSelectorOpen(false); handleViewEditProposal(proposal.id); }} className="w-full text-left border rounded-lg p-4 flex flex-col md:flex-row justify-between md:items-center bg-white cursor-pointer hover:border-purple-400 hover:shadow-md transition-all">
                        <div className="mb-2 md:mb-0">
                            <p className="font-semibold text-slate-900 flex items-center flex-wrap gap-2">
                                {proposal.isProjectLevel && proposal.title ? proposal.title : `${proposal.id} - ${proposal.customerName}`}
                                {proposal.jobId && proposal.jobId !== job.id && (
                                    <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded font-bold">
                                        {t("Linked to Job")} #{proposal.jobId}
                                    </span>
                                )}
                            </p>
                            <p className="text-sm text-slate-500">
                                {new Date(proposal.createdAt).toLocaleDateString()} • {
                                    proposal.isProjectLevel
                                        ? (proposal.laborItems?.length || 0) + (proposal.partItems?.length || 0) + (proposal.allowanceItems?.length || 0)
                                        : (proposal.items?.length || 0)
                                } {t("items")}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-green-700">${(proposal.total || 0).toFixed(2)}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${proposal.status === 'Accepted' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>{proposal.status === 'Accepted' ? t('Accepted') : t('Draft')}</span>
                        </div>
                    </button>
                ))}
            </div>
        </Modal>

        {/* Invoice Selector Modal */}
        <Modal isOpen={isInvoiceSelectorOpen} onClose={() => setIsInvoiceSelectorOpen(false)} title={t("Select Existing Invoice")}>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                <p className="text-sm text-slate-500 mb-4">{t("Select an invoice from another job for this customer to import the line items.")}</p>
                {(!state.jobs || state.jobs.filter(j => j.invoice && (j.customerId === job.customerId || (j.customerName && j.customerName !== 'Unknown Customer' && job.customerName && j.customerName.toLowerCase() === job.customerName.toLowerCase())) && j.id !== job.id).length === 0) && (
                    <div className="text-center p-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed">{t("No other invoices found for this customer.")}</div>
                )}                {state.jobs?.filter(j => j.invoice && (j.customerId === job.customerId || (j.customerName && j.customerName !== 'Unknown Customer' && job.customerName && j.customerName.toLowerCase() === job.customerName.toLowerCase())) && j.id !== job.id)
                    .sort((a,b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime())
                    .map(j => (
                    <button type="button" key={j.id} onClick={() => { handleImportSelectedInvoice(j.id); }} className="w-full text-left border rounded-lg p-4 flex flex-col md:flex-row justify-between md:items-center bg-white cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
                        <div className="mb-2 md:mb-0">
                            <p className="font-semibold text-slate-900">INV-{j.invoice?.id || j.id} - {j.customerName}</p>
                            <p className="text-sm text-slate-500">{new Date(j.createdAt||0).toLocaleDateString()} • {j.invoice?.items?.length || 0} {j.invoice?.items?.length === 1 ? t("item") : t("items")}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-green-700">${(Number(j.invoice?.totalAmount || j.invoice?.amount) || 0).toFixed(2)}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${j.invoice?.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>{j.invoice?.status === 'Paid' ? t('Paid') : t('Pending')}</span>
                        </div>
                    </button>
                ))}
            </div>
        </Modal>

        {/* Improved Refrigerant Modal */}
        <Modal isOpen={isRefrigerantModalOpen} onClose={() => setIsRefrigerantModalOpen(false)} title={t("Log Refrigerant Usage")}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Select label={t("Refrigerant Type")} value={refrigerantEntry.type} onChange={e => setRefrigerantEntry({...refrigerantEntry, type: e.target.value})}>
                        <option>R-410A</option>
                        <option>R-22</option>
                        <option>R-404A</option>
                        <option>R-134A</option>
                        <option>R-32</option>
                        <option>R-438A (MO99)</option>
                    </Select>
                    <Select label={t("Action")} value={refrigerantEntry.action} onChange={e => setRefrigerantEntry({...refrigerantEntry, action: e.target.value})}>
                        <option value="Added">{t("Added")}</option>
                        <option value="Recovered">{t("Recovered")}</option>
                        <option value="Reclaimed">{t("Reclaimed")}</option>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t("Amount")} type="number" step="0.1" value={refrigerantEntry.amount} onChange={e => setRefrigerantEntry({...refrigerantEntry, amount: e.target.value})} placeholder={t("e.g. 2.5")}/>
                    <Select label={t("Unit")} value={refrigerantEntry.unit} onChange={e => setRefrigerantEntry({...refrigerantEntry, unit: e.target.value})}>
                        <option value="lbs">{t("lbs")}</option>
                        <option value="oz">{t("oz")}</option>
                        <option value="kg">{t("kg")}</option>
                    </Select>
                </div>
                
                <Select label={t("Select Container/Cylinder")} value={refrigerantEntry.cylinderNumber} onChange={e => setRefrigerantEntry({...refrigerantEntry, cylinderNumber: e.target.value})}>
                    <option value="">{t("-- Choose Container --")}</option>
                    {state.refrigerantCylinders?.map(c => (
                        <option key={c.id} value={c.id}>{c.type} - {c.tag} ({t(c.status)}) [{c.remainingWeight.toFixed(1)} {t("lbs left")}]</option>
                    ))}
                    <option value="CUSTOM">{t("Manual Entry...")}</option>
                </Select>

                {refrigerantEntry.cylinderNumber === 'CUSTOM' && (
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Input label={t("Manual Cylinder #")} placeholder={t("Enter serial or tracking #")} value={customCylString} onChange={e => setCustomCylString(e.target.value)} />
                        </div>
                        <BarcodeScannerButton onScan={(text) => setCustomCylString(text)} />
                    </div>
                )}

                 <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={() => setIsRefrigerantModalOpen(false)}>{t("Cancel")}</Button>
                    <Button onClick={handleAddRefrigerant} disabled={!refrigerantEntry.amount || !refrigerantEntry.cylinderNumber}>{t("Log Usage")}</Button>
                </div>
            </div>
        </Modal>

        {/* Parts Selection Modal */}
        <Modal isOpen={isPartModalOpen} onClose={() => setIsPartModalOpen(false)} title={t("Add Parts from Inventory")}>
            <div className="space-y-4">
                {!selectedPart ? (
                    <>
                        <Input 
                            label={t("Search Inventory")} 
                            placeholder={t("Search by name, SKU or barcode...")} 
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
                                        <p className="text-[10px] text-slate-400 uppercase font-black">SKU: {item.sku} • {t(item.location)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-emerald-600">${item.price}</p>
                                        <p className={`text-[10px] font-bold ${item.quantity <= item.minQuantity ? 'text-red-500' : 'text-slate-500'}`}>{t("Stock")}: {item.quantity}</p>
                                    </div>
                                </button>
                            ))}
                            {state.inventory.length === 0 && <p className="p-4 text-center text-xs text-slate-400">{t("Inventory is empty.")}</p>}
                        </div>
                        {partSearch && state.inventory.filter(i => i.name.toLowerCase().includes(partSearch.toLowerCase())).length === 0 && (
                            <div className="p-3 bg-white dark:bg-slate-800 text-center border-t border-slate-200 dark:border-slate-700">
                                <Button variant="secondary" onClick={() => {
                                    setSelectedPart({ id: 'custom', name: partSearch, sku: '', price: 0, quantity: 999, minQuantity: 0, location: 'Manual Entry' });
                                    setPartPaymentMethod('company'); // Default for off-site procurement
                                }} className="w-full text-xs font-bold border-dashed border-2 border-primary-300 dark:border-primary-700">
                                    {t("+ Procure \"{name}\" from Parts House", { name: partSearch })}
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-900/20">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-black text-primary-600 uppercase tracking-tight">{selectedPart.name}</h4>
                                <p className="text-xs text-slate-500">{t("Inventory SKU")}: {selectedPart.sku}</p>
                            </div>
                            <button title={t("Clear Selection")} onClick={() => setSelectedPart(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label={t("Quantity Used")} type="number" value={partQuantity} onChange={e => setPartQuantity(Number(e.target.value))} min={1} />
                            {selectedPart.id === 'custom' ? (
                                <Input label={t("Est. Price (Each)")} type="number" step="0.01" value={selectedPart.price || ''} onChange={e => setSelectedPart({...selectedPart, price: parseFloat(e.target.value) || 0})} />
                            ) : (
                                <Select label={t("Pulled From")} value={partLocation} onChange={e => setPartLocation(e.target.value)}>
                                    <option value="Truck">{t("Truck")}</option>
                                    <option value="Warehouse">{t("Warehouse")}</option>
                                    <option value="Job Site">{t("Job Site")}</option>
                                </Select>
                            )}
                            {selectedPart.id === 'custom' && (
                                <Input label={t("Part Number / SKU")} value={selectedPart.sku || ''} onChange={e => setSelectedPart({...selectedPart, sku: e.target.value})} placeholder={t("Optional: Manufacturer part #")} className="col-span-2" />
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-primary-100 dark:border-primary-900/20">
                            <Select label={t("Payment / Sourcing Workflow")} value={partPaymentMethod} onChange={e => setPartPaymentMethod(e.target.value as any)}>
                                <option value="inventory">{t("Already in Stock (Inventory)")}</option>
                                <option value="company">{t("Bought with Company Card (Parts House)")}</option>
                                <option value="personal">{t("Bought with Personal Funds (Reimburse Me)")}</option>
                                <option value="other">{t("Other Sourcing Method")}</option>
                            </Select>

                            {(partPaymentMethod === 'personal' || partPaymentMethod === 'company' || partPaymentMethod === 'other') && (
                                <div className="mt-4 space-y-4">
                                    {partPaymentMethod === 'other' && (
                                        <Textarea 
                                            label={t("Explanation")} 
                                            placeholder={t("Explain payment method...")} 
                                            value={(selectedPart as any).explanation || ''} 
                                            onChange={e => setSelectedPart({...selectedPart, explanation: e.target.value} as any)} 
                                        />
                                    )}
                                    <div>
                                        <p className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">{t("Upload Receipt / Invoice")}</p>
                                        <div className="flex items-center gap-3">
                                            <input type="file" accept="image/*,application/pdf" onChange={handleReceiptUpload} className="hidden" id="part-receipt" />
                                            <label htmlFor="part-receipt" className={`cursor-pointer px-4 py-2 ${partReceipt ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-white dark:bg-slate-800 border border-slate-300'} rounded shadow-sm text-sm font-medium hover:bg-opacity-80 transition-colors`}>
                                                {partReceipt ? t("Receipt Captured ✓") : t("Take Photo / Upload")}
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 italic">
                                            {partPaymentMethod === 'personal' ? t("Required for fast reimbursement.") : t("Required for review and compliance.")}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-primary-100 dark:border-primary-900/20 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setSelectedPart(null)} className="w-auto">{t("Change Part")}</Button>
                            <Button onClick={handleAddPart} className="w-auto">{t("Confirm & Add")}</Button>
                        </div>
                    </div>
                )}
                 <div className="flex justify-end pt-4">
                    <Button variant="secondary" onClick={() => setIsPartModalOpen(false)} className="w-full">{t("Cancel")}</Button>
                </div>
            </div>
        </Modal>

        {/* Tool Reading Modal */}
        <Modal 
            isOpen={isToolReadingModalOpen} 
            onClose={() => {
                setIsToolReadingModalOpen(false);
                setNewReading({ id: '', toolType: '', summary: '', phase: 'before', assetId: '', reportUrl: '' });
                setUploadedDiagnosticName('');
            }} 
            title={t("Add Tool Reading")}
        >
            <div className="space-y-4">
                <Select label={t("Tool Type")} value={newReading.toolType} onChange={e => setNewReading({...newReading, toolType: e.target.value})}>
                    <option value="">{t("-- Select Tool --")}</option>
                    <option>Sman Digital Manifold</option>
                    <option>JobLink Probes</option>
                    <option>Scale</option>
                    <option>Multimeter</option>
                    <option>Thermal Camera</option>
                    <option>Vacuum Gauge</option>
                </Select>
                <Select label={t("Reading Stage")} value={newReading.phase || 'before'} onChange={e => setNewReading({...newReading, phase: e.target.value})}>
                    <option value="before">{t("Before Repair / Diagnostic")}</option>
                    <option value="after">{t("After Repair / Verification")}</option>
                </Select>
                {assets && assets.length > 0 && (
                    <Select label={t("Associated Unit (Optional)")} value={newReading.assetId || ''} onChange={e => setNewReading({...newReading, assetId: e.target.value})}>
                        <option value="">{t("General / Not Unit Specific")}</option>
                        {assets.map(asset => (
                            <option key={asset.id} value={asset.id}>
                                {asset.name || asset.type} {asset.serial ? `(${asset.serial.slice(-4)})` : ''}
                            </option>
                        ))}
                    </Select>
                )}
                <Textarea label={t("Reading Summary")} placeholder={t("e.g. Low Side: 120 PSI, High Side: 350 PSI, Subcool: 12F")} value={newReading.summary} onChange={e => setNewReading({...newReading, summary: e.target.value})} />
                
                <div className="pt-2">
                    <p className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">{t("Attach Reading/Diagnostic Screenshot (Optional)")}</p>
                    <div className="flex items-center gap-3">
                        <input 
                            type="file" 
                            accept="image/*,application/pdf" 
                            onChange={handleDiagnosticFileUpload} 
                            className="hidden" 
                            id="reading-upload" 
                            disabled={isUploadingDiagnostic}
                        />
                        <label 
                            htmlFor="reading-upload" 
                            className={`cursor-pointer px-4 py-2 ${
                                newReading.reportUrl 
                                    ? "bg-green-100 text-green-700 border border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50" 
                                    : "bg-white dark:bg-slate-800 border border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                            } rounded shadow-sm text-sm font-medium transition-colors`}
                        >
                            {isUploadingDiagnostic 
                                ? t("Uploading...") 
                                : newReading.reportUrl 
                                    ? t("File Attached ✓") 
                                    : t("Upload Diagnostic File")
                            }
                        </label>
                        {uploadedDiagnosticName && (
                            <span className="text-xs text-slate-500 truncate max-w-[200px]" title={uploadedDiagnosticName}>
                                {uploadedDiagnosticName}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button 
                        variant="secondary" 
                        onClick={() => {
                            setIsToolReadingModalOpen(false);
                            setNewReading({ id: '', toolType: '', summary: '', phase: 'before', assetId: '', reportUrl: '' });
                            setUploadedDiagnosticName('');
                        }}
                    >
                        {t("Cancel")}
                    </Button>
                    <Button 
                        onClick={handleAddReading} 
                        disabled={isUploadingDiagnostic || !newReading.toolType || !newReading.summary}
                    >
                        {t("Save Reading")}
                    </Button>
                </div>
            </div>
        </Modal>

        <Modal isOpen={isPayableModalOpen} onClose={() => {setIsPayableModalOpen(false); onClose();}} title={t("Enter Payable Amount")}>
            <div className="space-y-4">
                <Input 
                    label={t("Payable Amount")}
                    type="number"
                    value={payableAmount}
                    onChange={(e) => setPayableAmount(Number(e.target.value))}
                    required
                />
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={() => {setIsPayableModalOpen(false); onClose();}}>{t("Cancel")}</Button>
                    <Button onClick={handlePayableModalSubmit}>{t("Save Payable")}</Button>
                </div>
            </div>
        </Modal>

        <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title={t("Import {target} Checklist", { target: t(importTarget.charAt(0).toUpperCase() + importTarget.slice(1)) })}>
            <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto border rounded divide-y">
                     {docTemplates.map(tmpl => (
                        <button key={tmpl.id} onClick={() => {
                            const items = tmpl.items.map((i: any, idx: number) => ({ id: `imp-${tmpl.id}-${idx}-${Date.now()}`, label: i.label, completed: false }));
                            const listKey = `${importTarget}Checklist` as const;
                            updateWorkflowState(listKey, [...workflowState[listKey], ...items]);
                            setIsImportModalOpen(false);
                        }} className="w-full text-left p-3 hover:bg-slate-50 flex justify-between items-center group">
                            <div><p className="font-bold text-sm">{tmpl.name}</p><p className="text-xs text-slate-400">{tmpl.items.length} {tmpl.items.length === 1 ? t("item") : t("items")}</p></div>
                            <ArrowRight size={16} className="text-slate-300 group-hover:text-primary-500"/>
                        </button>
                    ))}
                </div>
                <Button variant="secondary" onClick={() => setIsImportModalOpen(false)} className="w-full">{t("Cancel")}</Button>
            </div>
        </Modal>
        
        {isInvoiceEditorOpen && <InvoiceEditorModal isOpen={true} onClose={() => setIsInvoiceEditorOpen(false)} jobId={job.id} />}
        <LiveAssistModal isOpen={isLiveAssistOpen} onClose={() => setIsLiveAssistOpen(false)} job={job} />
        <WaiverModal isOpen={isWaiverOpen} onClose={() => setIsWaiverOpen(false)} onSign={() => {}} job={job} />
        <SignOffModal isOpen={isSignOffOpen} onClose={() => setIsSignOffOpen(false)} job={job} onSave={handleSaveSignOff} />
        <SubcontractorBillModal isOpen={isSubBillOpen} onClose={() => setIsSubBillOpen(false)} job={job} onSave={handleSaveSignOff} />

        <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScanResult} />
        <WebCameraModal isOpen={isWebCameraOpen} onClose={() => {
            setIsWebCameraOpen(false);
            setAssetCameraTarget(null);
        }} onCapture={(dataUrl) => {
             setIsWebCameraOpen(false);
             const target = assetCameraTarget;
             setAssetCameraTarget(null);
             fetch(dataUrl).then(r => r.blob()).then(async blob => {
                  const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
                  if (target) {
                      const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                      await handleAssetPhotoUpload(mockEvent, target);
                  } else {
                      processCapturedFile(file, cameraLabel);
                  }
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

        {previewDoc && (
            <DocumentPreview 
                type="Other" 
                data={previewDoc} 
                onClose={() => setPreviewDoc(null)} 
            />
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
        
        {isScheduleFollowUpOpen && (
            <JobAppointmentModal
                isOpen={isScheduleFollowUpOpen}
                onClose={() => {
                    setIsScheduleFollowUpOpen(false);
                    onClose();
                }}
                parentJobToLink={job}
            />
        )}
        
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

        {isAddAssetOpen && (
            <Modal
                isOpen={isAddAssetOpen}
                onClose={() => setIsAddAssetOpen(false)}
                title={newAsset.id ? t("Edit Asset") : t("Add New Asset")}
            >
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar text-left">
                    {/* Core Details */}
                    <div className="space-y-3">
                        <Input label={t("Name (e.g. Roof Unit 1)")} value={newAsset.name || ''} onChange={e => setNewAsset({...newAsset, name: e.target.value})} placeholder={t("Optional: System Name")}/>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Select label={t("Type")} value={newAsset.type || equipmentOptions[0] || 'System'} onChange={e => setNewAsset({...newAsset, type: e.target.value})}>
                                {equipmentOptions.map((opt: string) => (
                                    <option key={opt} value={opt}>{t(opt)}</option>
                                ))}
                            </Select>
                            <Input label={t("Asset Tag (Barcode/QR)")} value={newAsset.assetTag || ''} onChange={e => setNewAsset({...newAsset, assetTag: e.target.value})} placeholder="e.g. TK-RTU-000142" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label={t("Brand")} value={newAsset.brand || ''} onChange={e => setNewAsset({...newAsset, brand: e.target.value})} placeholder="e.g. Trane, Goodman"/>
                            <Input label={t("Model")} value={newAsset.model || ''} onChange={e => setNewAsset({...newAsset, model: e.target.value})} placeholder="e.g. XV20i"/>
                        </div>
                    </div>
                    
                    {/* Serial & OCR */}
                    <div className="flex items-center gap-2 relative">
                        <div className="flex-1">
                            <Input label={t("Serial Number")} value={newAsset.serial || ''} onChange={e => setNewAsset({...newAsset, serial: e.target.value})} placeholder="e.g. 12345ABC"/>
                        </div>
                        {isOcrScanning && <div className="absolute right-3 top-9 text-xs text-primary-500 font-bold animate-pulse flex items-center gap-1"><Sparkles size={12}/> {t("Scanning...")}</div>}
                    </div>

                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            disabled={isResearching || !newAsset?.model}
                            onClick={handleResearchSpecs}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-800 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                        >
                            <Sparkles size={14} className={isResearching ? "animate-spin" : ""} />
                            {isResearching ? t("Researching Technical Specs (AI)...") : t("Research & Auto-fill Specs (AI)")}
                        </button>
                    </div>

                    {/* Technical Specifications */}
                    <div className="space-y-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Layers size={12} /> {t("Technical Specifications")}</h6>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input 
                                label={t("Year")} 
                                type="text"
                                value={newAsset.year || ''} 
                                onChange={e => setNewAsset({...newAsset, year: e.target.value})} 
                                placeholder="e.g. 2018" 
                            />
                            <Input 
                                label={t("Tonnage (Size in Tons)")} 
                                type="number"
                                step="any"
                                value={newAsset.tonnage ?? ''} 
                                onChange={e => setNewAsset({...newAsset, tonnage: e.target.value === '' ? undefined : Number(e.target.value)})} 
                                placeholder="e.g. 3.5" 
                            />
                            <Input 
                                label={t("Refrigerant Type")} 
                                type="text"
                                value={newAsset.refrigerantType || ''} 
                                onChange={e => setNewAsset({...newAsset, refrigerantType: e.target.value})} 
                                placeholder="e.g. R410A, R22" 
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input 
                                label={t("Heat Type")} 
                                type="text"
                                value={newAsset.heatType || ''} 
                                onChange={e => setNewAsset({...newAsset, heatType: e.target.value})} 
                                placeholder="e.g. Gas, Electric, Heat Pump" 
                            />
                            <Input 
                                label={t("Electricity Type / Specs")} 
                                type="text"
                                value={newAsset.electricityType || ''} 
                                onChange={e => setNewAsset({...newAsset, electricityType: e.target.value})} 
                                placeholder="e.g. 230V / 1ph" 
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input 
                                label={t("SEER Rating")} 
                                type="text"
                                value={newAsset.seerRating || ''} 
                                onChange={e => setNewAsset({...newAsset, seerRating: e.target.value})} 
                                placeholder="e.g. 14, 16" 
                            />
                            <Input 
                                label={t("Filter Size / Type")} 
                                type="text"
                                value={newAsset.filterType || ''} 
                                onChange={e => setNewAsset({...newAsset, filterType: e.target.value})} 
                                placeholder="e.g. 20x25x1" 
                            />
                        </div>
                    </div>

                    {/* SECTION: Auto-Create & Link Air Handler */}
                    {['System', 'Split System', 'Package Unit', 'Condenser', 'Heat Pump'].includes(newAsset?.type || '') && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300"
                                    checked={autoCreateAirHandler}
                                    onChange={e => setAutoCreateAirHandler(e.target.checked)}
                                />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("Auto-create and link an Air Handler")}</span>
                            </label>
                            
                            {autoCreateAirHandler && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <Input 
                                        label={t("Air Handler Name")} 
                                        value={airHandlerDetails.name} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, name: e.target.value})} 
                                        placeholder={t("e.g. Air Handler 1")}
                                    />
                                    <Select 
                                        label={t("Air Handler Location (Floor/Space)")} 
                                        value={airHandlerDetails.propertyId} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, propertyId: e.target.value})}
                                    >
                                        <option value="">{t("-- Same Location as Condenser --")}</option>
                                        {(customerObj?.serviceLocations || []).map((l: any) => (
                                            <option key={l.id} value={l.id}>{l.name} ({l.locationType || 'Location'})</option>
                                        ))}
                                    </Select>
                                    <Input 
                                        label={t("Air Handler Brand")} 
                                        value={airHandlerDetails.brand} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, brand: e.target.value})} 
                                        placeholder={t("e.g. Trane, Goodman")}
                                    />
                                    <Input 
                                        label={t("Air Handler Model")} 
                                        value={airHandlerDetails.model} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, model: e.target.value})} 
                                        placeholder={t("Model #")}
                                    />
                                    <Input 
                                        label={t("Air Handler Serial")} 
                                        value={airHandlerDetails.serial} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, serial: e.target.value})} 
                                        placeholder={t("Serial #")}
                                    />
                                    <div className="md:col-span-2 pt-1">
                                        <button
                                            type="button"
                                            disabled={isResearchingAirHandler || !airHandlerDetails?.model}
                                            onClick={handleResearchAirHandlerSpecs}
                                            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-800 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                                        >
                                            <Sparkles size={14} className={isResearchingAirHandler ? "animate-spin" : ""} />
                                            {isResearchingAirHandler ? t("Researching Air Handler Specs (AI)...") : t("Research & Auto-fill Air Handler Specs (AI)")}
                                        </button>
                                    </div>
                                    <Input 
                                        label={t("Exact Placement (Closet/Mechanical Room)")} 
                                        value={airHandlerDetails.exactPlacement} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, exactPlacement: e.target.value})} 
                                        placeholder={t("e.g. Janitorial closet by office")}
                                    />
                                    <Input 
                                        label={t("Serves Area / Space")} 
                                        value={airHandlerDetails.servesArea} 
                                        onChange={e => setAirHandlerDetails({...airHandlerDetails, servesArea: e.target.value})} 
                                        placeholder={t("e.g. Main Lobby")}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECTION: Auto-Create & Link Thermostat */}
                    {['System', 'Split System', 'Package Unit', 'Furnace', 'Condenser', 'Air Handler', 'Heat Pump'].includes(newAsset?.type || '') && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300"
                                    checked={autoCreateThermostat}
                                    onChange={e => setAutoCreateThermostat(e.target.checked)}
                                />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("Auto-create and link a Thermostat")}</span>
                            </label>
                            
                            {autoCreateThermostat && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <Input 
                                        label={t("Thermostat Name")} 
                                        value={thermostatDetails.name} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, name: e.target.value})} 
                                        placeholder={t("e.g. Thermostat 1")}
                                    />
                                    <Select 
                                        label={t("Thermostat Location (Floor/Space)")} 
                                        value={thermostatDetails.propertyId} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, propertyId: e.target.value})}
                                    >
                                        <option value="">{t("-- Same Location as System --")}</option>
                                        {(customerObj?.serviceLocations || []).map((l: any) => (
                                            <option key={l.id} value={l.id}>{l.name} ({l.locationType || 'Location'})</option>
                                        ))}
                                    </Select>
                                    <Input 
                                        label={t("Thermostat Brand")} 
                                        value={thermostatDetails.brand} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, brand: e.target.value})} 
                                        placeholder={t("e.g. Honeywell, Nest")}
                                    />
                                    <Input 
                                        label={t("Thermostat Model")} 
                                        value={thermostatDetails.model} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, model: e.target.value})} 
                                        placeholder={t("Model #")}
                                    />
                                    <Input 
                                        label={t("Exact Placement (Internal)")} 
                                        value={thermostatDetails.exactPlacement} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, exactPlacement: e.target.value})} 
                                        placeholder={t("e.g. Back hallway by office")}
                                    />
                                    <Input 
                                        label={t("Serves Area / Space")} 
                                        value={thermostatDetails.servesArea} 
                                        onChange={e => setThermostatDetails({...thermostatDetails, servesArea: e.target.value})} 
                                        placeholder={t("e.g. Main Lobby")}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Link to other Equipment */}
                    <div className="space-y-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Layers size={12} /> {t("Link to other Equipment (Legacy)")}</h6>
                        <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800/50 space-y-2 custom-scrollbar">
                            {(() => {
                                const eligibleEquipment = (customerObj?.equipment || []).filter((e: any) => e.id !== newAsset.id);
                                if (eligibleEquipment.length === 0) {
                                    return <p className="text-xs text-slate-500 text-center py-2">{t("No other equipment to link")}</p>;
                                }
                                
                                const locations = customerObj?.serviceLocations || [];
                                const equipmentByLocation: Record<string, any[]> = {};
                                const unassigned: any[] = [];
                                
                                eligibleEquipment.forEach((eq: any) => {
                                    if (eq.propertyId) {
                                        const loc = locations.find((l: any) => l.id === eq.propertyId);
                                        if (loc) {
                                            if (!equipmentByLocation[loc.id]) {
                                                equipmentByLocation[loc.id] = [];
                                            }
                                            equipmentByLocation[loc.id].push(eq);
                                            return;
                                        }
                                    }
                                    unassigned.push(eq);
                                });

                                return (
                                    <div className="space-y-2">
                                        {locations.map((loc: any) => {
                                            const groupEq = equipmentByLocation[loc.id] || [];
                                            if (groupEq.length === 0) return null;
                                            return (
                                                <details key={loc.id} className="group border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                                                    <summary className="flex items-center justify-between p-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                        <span className="flex items-center gap-1.5">
                                                            <MapPin size={12} className="text-primary-500" />
                                                            {loc.name} ({groupEq.length})
                                                        </span>
                                                        <ChevronDown size={14} className="transition-transform group-open:rotate-180 text-slate-400" />
                                                    </summary>
                                                    <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1 bg-slate-50 dark:bg-slate-900/50">
                                                        {groupEq.map((opt: any) => (
                                                            <label key={opt.id} className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                                                                    checked={newAsset.linkedAssetIds?.includes(opt.id) || false}
                                                                    onChange={(e) => {
                                                                        const currentLinks = newAsset.linkedAssetIds || [];
                                                                        if (e.target.checked) {
                                                                            setNewAsset({...newAsset, linkedAssetIds: [...currentLinks, opt.id]});
                                                                        } else {
                                                                            setNewAsset({...newAsset, linkedAssetIds: currentLinks.filter(id => id !== opt.id)});
                                                                        }
                                                                    }}
                                                                />
                                                                <span className="text-xs text-slate-700 dark:text-slate-300">{opt.name || opt.brand} ({opt.model})</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </details>
                                            );
                                        })}
                                        
                                        {unassigned.length > 0 && (
                                            <details className="group border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                                                <summary className="flex items-center justify-between p-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    <span className="flex items-center gap-1.5">
                                                        <Layers size={12} className="text-slate-400" />
                                                        Unassigned Location ({unassigned.length})
                                                    </span>
                                                    <ChevronDown size={14} className="transition-transform group-open:rotate-180 text-slate-400" />
                                                </summary>
                                                <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1 bg-slate-50 dark:bg-slate-900/50">
                                                    {unassigned.map((opt: any) => (
                                                        <label key={opt.id} className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                                                                checked={newAsset.linkedAssetIds?.includes(opt.id) || false}
                                                                onChange={(e) => {
                                                                    const currentLinks = newAsset.linkedAssetIds || [];
                                                                    if (e.target.checked) {
                                                                        setNewAsset({...newAsset, linkedAssetIds: [...currentLinks, opt.id]});
                                                                    } else {
                                                                        setNewAsset({...newAsset, linkedAssetIds: currentLinks.filter(id => id !== opt.id)});
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-xs text-slate-700 dark:text-slate-300">{opt.name || opt.brand} ({opt.model})</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                    
                    {/* Hierarchy Locations */}
                    <div className="space-y-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin size={12} /> {t("Physical Placement Hierarchy")}</h6>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Select label={t("Property Mapping")} value={newAsset.propertyId || ''} onChange={e => setNewAsset({...newAsset, propertyId: e.target.value})}>
                                <option value="">{t("Default Address")}</option>
                                {customerObj?.serviceLocations?.map((loc: any) => (
                                    <option key={loc.id} value={loc.id}>{loc.name} - {loc.address}</option>
                                ))}
                            </Select>
                            <Select label={t("Area (Physical Location)")} value={newAsset.physicalLocation || ''} onChange={e => setNewAsset({...newAsset, physicalLocation: e.target.value})}>
                                <option value="">-- {t("Select Area")} --</option>
                                {PHYSICAL_LOCATION_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </Select>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label={t("Exact Placement Placement")} value={newAsset.exactPlacement || ''} onChange={e => setNewAsset({...newAsset, exactPlacement: e.target.value})} placeholder="e.g. Front left corner on roof box"/>
                            <Input label={t("Serves Area (Zone/Box)")} value={newAsset.servesArea || ''} onChange={e => setNewAsset({...newAsset, servesArea: e.target.value})} placeholder="e.g. Dining room, Walk-in freezer box"/>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label={t("Sub-Location (Legacy)")} value={newAsset.location || ''} onChange={e => setNewAsset({...newAsset, location: e.target.value})} placeholder="e.g. Roof, Attic"/>
                            <div className="grid grid-cols-2 gap-2">
                                <Input 
                                    label={t("GPS Latitude")} 
                                    type="number" 
                                    step="any"
                                    value={newAsset.gpsPin?.lat ?? ''} 
                                    onChange={e => {
                                        const currentPin = newAsset.gpsPin || { lat: 0, lng: 0 };
                                        setNewAsset({...newAsset, gpsPin: { ...currentPin, lat: e.target.value === '' ? 0 : Number(e.target.value) }});
                                    }} 
                                    placeholder="29.4241"
                                />
                                <Input 
                                    label={t("GPS Longitude")} 
                                    type="number" 
                                    step="any"
                                    value={newAsset.gpsPin?.lng ?? ''} 
                                    onChange={e => {
                                        const currentPin = newAsset.gpsPin || { lat: 0, lng: 0 };
                                        setNewAsset({...newAsset, gpsPin: { ...currentPin, lng: e.target.value === '' ? 0 : Number(e.target.value) }});
                                    }} 
                                    placeholder="-98.4936"
                                />
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={async () => {
                                setGpsLoading(true);
                                try {
                                    const loc = await getCurrentLocation();
                                    if (loc) {
                                        setNewAsset(prev => ({
                                            ...prev,
                                            gpsPin: { lat: loc.latitude, lng: loc.longitude }
                                        }));
                                        showToast.success(t("GPS Coordinates Captured!"));
                                    } else {
                                        showToast.error(t("Failed to capture location. Please check device permissions."));
                                    }
                                } catch (err) {
                                    showToast.error(t("Error capturing GPS coordinates."));
                                } finally {
                                    setGpsLoading(false);
                                }
                            }}
                            disabled={gpsLoading}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-800 rounded bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold h-9 transition-colors disabled:opacity-50 mt-1"
                        >
                            <MapPin size={14} className={gpsLoading ? "animate-bounce" : ""} />
                            {gpsLoading ? t("Capturing GPS...") : t("Capture Device GPS")}
                        </button>
                    </div>

                    {/* Refrigeration Linking */}
                    <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-lg border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                checked={isLinkedToSystem}
                                onChange={(e) => {
                                    setIsLinkedToSystem(e.target.checked);
                                    if (e.target.checked && uniqueSystemGroups.length > 0 && !selectedSystemGroupId) {
                                        setSelectedSystemGroupId(uniqueSystemGroups[0].id);
                                    }
                                }}
                            />
                            <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                                <Layers size={14} /> Link to a Refrigeration / Split System Group
                            </span>
                        </label>

                        {isLinkedToSystem && (
                            <div className="pl-6 space-y-3 border-l-2 border-indigo-200 dark:border-indigo-800 mt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Select 
                                        label="System Group" 
                                        value={selectedSystemGroupId} 
                                        onChange={e => setSelectedSystemGroupId(e.target.value)}
                                    >
                                        {uniqueSystemGroups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                        <option value="NEW">-- Create New System Group --</option>
                                    </Select>

                                    <Select 
                                        label="Component Role in System" 
                                        value={newAsset.systemGroupRole || 'Standalone'} 
                                        onChange={e => setNewAsset({...newAsset, systemGroupRole: e.target.value})}
                                    >
                                        <option value="Evaporator">Evaporator (Inside Box)</option>
                                        <option value="Condensing Unit">Condensing Unit (Outside / Roof)</option>
                                        <option value="Controller">Controller (Near Door / Wall)</option>
                                        <option value="Compressor">Compressor</option>
                                        <option value="Standalone">Standalone Component</option>
                                    </Select>
                                </div>

                                {selectedSystemGroupId === 'NEW' && (
                                    <Input 
                                        label="New System Group Name" 
                                        value={newSystemGroupName} 
                                        onChange={e => setNewSystemGroupName(e.target.value)} 
                                        placeholder="e.g. Walk-In Freezer #1, Deli Line System"
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* General Attributes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input label={t("Install Date")} type="date" value={newAsset.installDate || ''} onChange={e => setNewAsset({...newAsset, installDate: e.target.value})} />
                        <Select label={t("Condition")} value={newAsset.condition || ''} onChange={e => setNewAsset({...newAsset, condition: e.target.value as EquipmentAsset['condition']})}>
                            <option value="">{t("Select Condition")}</option>
                            <option value="Excellent">{t("Excellent")}</option>
                            <option value="Good">{t("Good")}</option>
                            <option value="Fair">{t("Fair")}</option>
                            <option value="Poor">{t("Poor")}</option>
                            <option value="Critical">{t("Critical")}</option>
                        </Select>
                    </div>
                    
                    <Input label={t("Notes")} value={newAsset.notes || ''} onChange={e => setNewAsset({...newAsset, notes: e.target.value})} placeholder={t("Additional details...")} />
                    
                    {/* 6-Channel Photo Capturing Section */}
                    <div>
                        <h6 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t("Asset Verification Photos")}</h6>
                        <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3 pt-1">
                            {/* Photo 1: OCR Serial Photo */}
                            <div className="shrink-0 flex flex-col gap-2">
                                <div className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl bg-white dark:bg-slate-900 text-xs text-center w-36 h-32 relative transition-colors shadow-sm overflow-hidden group">
                                    {newAsset.serialPhotoUrl ? (
                                        <>
                                            <img src={newAsset.serialPhotoUrl} alt="Serial" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewAsset({...newAsset, serialPhotoUrl: '', serialPhotoLabel: ''}); }} className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full z-10 shadow-md transition-transform hover:scale-110" title="Remove Photo" aria-label="Remove Photo">
                                                <X size={12}/>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full">
                                            <span className="font-medium text-slate-600 dark:text-slate-300 mb-2">{t("OCR Serial Photo")}</span>
                                            <div className="flex gap-2">
                                                <label className="flex flex-col items-center justify-center cursor-pointer p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Upload from Gallery">
                                                    <ImageIcon size={16} className="text-primary-500" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'serialPhotoUrl')} title="Upload OCR Serial Photo" />
                                                </label>
                                                <button type="button" onClick={() => handleNativeAssetCameraTrigger('serialPhotoUrl')} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Take Photo">
                                                    <CameraIcon size={16} className="text-primary-500" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {newAsset.serialPhotoUrl && (
                                    <input 
                                        type="text" 
                                        placeholder={t("Add description...")} 
                                        value={newAsset.serialPhotoLabel || ''} 
                                        onChange={e => setNewAsset({...newAsset, serialPhotoLabel: e.target.value})}
                                        className="w-36 text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                )}
                            </div>

                            {/* Photo 2: OCR Unit Data Plate */}
                            <div className="shrink-0 flex flex-col gap-2">
                                <div className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl bg-white dark:bg-slate-900 text-xs text-center w-36 h-32 relative transition-colors shadow-sm overflow-hidden group">
                                    {newAsset.unitTagPhotoUrl ? (
                                        <>
                                            <img src={newAsset.unitTagPhotoUrl} alt="Tag" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewAsset({...newAsset, unitTagPhotoUrl: '', unitTagPhotoLabel: ''}); }} className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full z-10 shadow-md transition-transform hover:scale-110" title="Remove Photo" aria-label="Remove Photo">
                                                <X size={12}/>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full">
                                            <span className="font-medium text-slate-600 dark:text-slate-300 mb-2">{t("OCR Unit Data Plate")}</span>
                                            <div className="flex gap-2">
                                                <label className="flex flex-col items-center justify-center cursor-pointer p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Upload from Gallery">
                                                    <ImageIcon size={16} className="text-primary-500" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'unitTagPhotoUrl')} title="Upload OCR Unit Data Plate Photo" />
                                                </label>
                                                <button type="button" onClick={() => handleNativeAssetCameraTrigger('unitTagPhotoUrl')} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Take Photo">
                                                    <CameraIcon size={16} className="text-primary-500" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {newAsset.unitTagPhotoUrl && (
                                    <input 
                                        type="text" 
                                        placeholder={t("Add description...")} 
                                        value={newAsset.unitTagPhotoLabel || ''} 
                                        onChange={e => setNewAsset({...newAsset, unitTagPhotoLabel: e.target.value})}
                                        className="w-36 text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                )}
                            </div>

                            {/* Photo 3: Condition Photo */}
                            <div className="shrink-0 flex flex-col gap-2">
                                <div className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl bg-white dark:bg-slate-900 text-xs text-center w-36 h-32 relative transition-colors shadow-sm overflow-hidden group">
                                    {newAsset.conditionPhotoUrl ? (
                                        <>
                                            <img src={newAsset.conditionPhotoUrl} alt="Condition" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewAsset({...newAsset, conditionPhotoUrl: '', conditionPhotoLabel: ''}); }} className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full z-10 shadow-md transition-transform hover:scale-110" title="Remove Photo" aria-label="Remove Photo">
                                                <X size={12}/>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full">
                                            <span className="font-medium text-slate-600 dark:text-slate-300 mb-2">{t("Condition Photo")}</span>
                                            <div className="flex gap-2">
                                                <label className="flex flex-col items-center justify-center cursor-pointer p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Upload from Gallery">
                                                    <ImageIcon size={16} className="text-primary-500" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'conditionPhotoUrl')} title="Upload Condition Photo" />
                                                </label>
                                                <button type="button" onClick={() => handleNativeAssetCameraTrigger('conditionPhotoUrl')} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Take Photo">
                                                    <CameraIcon size={16} className="text-primary-500" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {newAsset.conditionPhotoUrl && (
                                    <input 
                                        type="text" 
                                        placeholder={t("Add description...")} 
                                        value={newAsset.conditionPhotoLabel || ''} 
                                        onChange={e => setNewAsset({...newAsset, conditionPhotoLabel: e.target.value})}
                                        className="w-36 text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                )}
                            </div>

                            {/* Photo 4: Wide Location Photo */}
                            <div className="shrink-0 flex flex-col gap-2">
                                <div className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl bg-white dark:bg-slate-900 text-xs text-center w-36 h-32 relative transition-colors shadow-sm overflow-hidden group">
                                    {newAsset.wideLocationPhotoUrl ? (
                                        <>
                                            <img src={newAsset.wideLocationPhotoUrl} alt="Location Context" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewAsset({...newAsset, wideLocationPhotoUrl: '', wideLocationPhotoLabel: ''}); }} className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full z-10 shadow-md transition-transform hover:scale-110" title="Remove Photo" aria-label="Remove Photo">
                                                <X size={12}/>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full">
                                            <span className="font-medium text-slate-600 dark:text-slate-300 mb-2">{t("Wide Location Photo")}</span>
                                            <div className="flex gap-2">
                                                <label className="flex flex-col items-center justify-center cursor-pointer p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Upload from Gallery">
                                                    <ImageIcon size={16} className="text-primary-500" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'wideLocationPhotoUrl')} title="Upload Wide Location Photo" />
                                                </label>
                                                <button type="button" onClick={() => handleNativeAssetCameraTrigger('wideLocationPhotoUrl')} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Take Photo">
                                                    <CameraIcon size={16} className="text-primary-500" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {newAsset.wideLocationPhotoUrl && (
                                    <input 
                                        type="text" 
                                        placeholder={t("Add description...")} 
                                        value={newAsset.wideLocationPhotoLabel || ''} 
                                        onChange={e => setNewAsset({...newAsset, wideLocationPhotoLabel: e.target.value})}
                                        className="w-36 text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                )}
                            </div>

                            {/* Photo 5: Access Point Photo */}
                            <div className="shrink-0 flex flex-col gap-2">
                                <div className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl bg-white dark:bg-slate-950 text-xs text-center w-36 h-32 relative transition-colors shadow-sm overflow-hidden group">
                                    {newAsset.accessPointPhotoUrl ? (
                                        <>
                                            <img src={newAsset.accessPointPhotoUrl} alt="Access Path" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewAsset({...newAsset, accessPointPhotoUrl: '', accessPointPhotoLabel: ''}); }} className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full z-10 shadow-md transition-transform hover:scale-110" title="Remove Photo" aria-label="Remove Photo">
                                                <X size={12}/>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full">
                                            <span className="font-medium text-slate-600 dark:text-slate-300 mb-2">{t("Access Point Photo")}</span>
                                            <div className="flex gap-2">
                                                <label className="flex flex-col items-center justify-center cursor-pointer p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Upload from Gallery">
                                                    <ImageIcon size={16} className="text-primary-500" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'accessPointPhotoUrl')} title="Upload Access Point Photo" />
                                                </label>
                                                <button type="button" onClick={() => handleNativeAssetCameraTrigger('accessPointPhotoUrl')} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Take Photo">
                                                    <CameraIcon size={16} className="text-primary-500" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {newAsset.accessPointPhotoUrl && (
                                    <input 
                                        type="text" 
                                        placeholder={t("Add description...")} 
                                        value={newAsset.accessPointPhotoLabel || ''} 
                                        onChange={e => setNewAsset({...newAsset, accessPointPhotoLabel: e.target.value})}
                                        className="w-36 text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                )}
                            </div>

                            {/* Photo 6: QR Code Photo */}
                            <div className="shrink-0 flex flex-col gap-2">
                                <div className="shrink-0 flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary-300 dark:border-slate-600 hover:border-primary-500 rounded-xl bg-white dark:bg-slate-900 text-xs text-center w-36 h-32 relative transition-colors shadow-sm overflow-hidden group">
                                    {newAsset.qrCodePhotoUrl ? (
                                        <>
                                            <img src={newAsset.qrCodePhotoUrl} alt="QR Code tag" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewAsset({...newAsset, qrCodePhotoUrl: '', qrCodePhotoLabel: ''}); }} className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full z-10 shadow-md transition-transform hover:scale-110" title="Remove Photo" aria-label="Remove Photo">
                                                <X size={12}/>
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full">
                                            <span className="font-medium text-slate-600 dark:text-slate-300 mb-2">{t("QR Tag Close-up")}</span>
                                            <div className="flex gap-2">
                                                <label className="flex flex-col items-center justify-center cursor-pointer p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Upload from Gallery">
                                                    <ImageIcon size={16} className="text-primary-500" />
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAssetPhotoUpload(e, 'qrCodePhotoUrl')} title="Upload QR Tag Photo" />
                                                </label>
                                                <button type="button" onClick={() => handleNativeAssetCameraTrigger('qrCodePhotoUrl')} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors" title="Take Photo">
                                                    <CameraIcon size={16} className="text-primary-500" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {newAsset.qrCodePhotoUrl && (
                                    <input 
                                        type="text" 
                                        placeholder={t("Add description...")} 
                                        value={newAsset.qrCodePhotoLabel || ''} 
                                        onChange={e => setNewAsset({...newAsset, qrCodePhotoLabel: e.target.value})}
                                        className="w-36 text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                        <Button variant="secondary" onClick={() => setIsAddAssetOpen(false)}>{t("Cancel")}</Button>
                        <Button onClick={handleSaveIntercept} disabled={isOcrScanning}>{isOcrScanning ? t("Scanning...") : t("Save Asset")}</Button>
                    </div>
                </div>
            </Modal>
        )}
        </>
    );
};

export default JobWorkflowModal;
