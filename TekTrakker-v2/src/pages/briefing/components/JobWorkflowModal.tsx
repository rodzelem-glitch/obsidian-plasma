/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Job, EquipmentAsset, StoredFile, InspectionTemplate, Subcontractor, Customer } from '../../../types';
import Modal from '../../../components/ui/Modal';
import JobAppointmentModal from '../../../components/modals/JobAppointmentModal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { Check, ArrowRight, Sparkles, X, Clock, MapPin, Navigation, Layers, ImageIcon, Camera as CameraIcon, ChevronDown, ExternalLink } from 'lucide-react';
import { EQUIPMENT_OPTIONS } from '@/constants/industryNaming';
import { db, firebase } from '../../../lib/firebase';
import { uploadFileToStorage } from '../../../lib/storageService';
import { offlineSyncManager } from '../../../lib/offlineSyncManager';
import { cleanUndefinedFields, compressFile } from '../../../lib/utils';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAppContext } from '../../../context/AppContext';
import Textarea from '../../../components/ui/Textarea';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from 'context/LanguageContext';
import { notifyAdminsJobPendingReview } from '../../../lib/notificationService';
import InvoiceEditorModal from '../../../components/modals/InvoiceEditorModal';
import IndustryToolsHub from '../../tools/IndustryToolsHub';
import Tesseract from 'tesseract.js';
import { scanDataPlatePhoto } from '../../../utils/dataPlateOcr';

// Sub-components
import ArrivalStep from './workflow/ArrivalStep';
import DiagnosisStep from './workflow/DiagnosisStep';
import RepairStep from './workflow/RepairStep';
import QualityStep from './workflow/QualityStep';
import BillingStep from './workflow/BillingStep';
import JobDashboardView from './JobDashboardView';
import SmartTechAssistant from './SmartTechAssistant';
import LiveAssistModal from './LiveAssistModal';
import WaiverModal from './WaiverModal';
import SignOffModal from './SignOffModal';
import ReopenJobModal from '../../../components/modals/ReopenJobModal';
import AuditHistoryModal from '../../../components/modals/AuditHistoryModal';
import SubcontractorBillModal from './SubcontractorBillModal';
import JobRecordReviewModal from './JobRecordReviewModal';
import JobDetailModal from '../../../components/modals/JobDetailModal';
import DocumentPreview from '../../../components/ui/DocumentPreview';
import JobChecklistsModal from './modals/JobChecklistsModal';
import JobProposalsModal from './modals/JobProposalsModal';
import JobToolsModal from './modals/JobToolsModal';
import JobBillingModal from './modals/JobBillingModal';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
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
    jobRecordSignedOff?: boolean;
    jobRecordSignedOffAt?: string;
    jobRecordSignedOffBy?: string;
    jobRecordSignedOffNotes?: string;
    customerSignature?: string | null;
    customerSignatureName?: string | null;
    siteManagerSignature?: string | null;
    siteManagerName?: string | null;
    techSignature?: string | null;
    techSignatureName?: string | null;
    signature?: string | null;
    signerName?: string | null;
    signatureTimestamp?: string | null;
    preWorkWaiverSignature?: string | null;
    preWorkWaiverSignedAt?: string | null;
    preWorkWaiverTitle?: string | null;
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
        refrigerantLog: Array.isArray(job.refrigerantLog) ? job.refrigerantLog : (job.refrigerantLog ? [job.refrigerantLog] : []),
        toolReadings: Array.isArray(job.toolReadings) ? job.toolReadings : (job.toolReadings && typeof job.toolReadings === 'object' ? [job.toolReadings] : []),
        partsUsed: Array.isArray((job as any).partsUsed) ? (job as any).partsUsed : ((job as any).partsUsed ? [(job as any).partsUsed] : []),
        techRecommendations: '',
        thankYouNote: job.notes?.thankYouNote || '',
        unitStates: [],
        jobRecordSignedOff: job.jobRecordSignedOff || false,
        jobRecordSignedOffAt: job.jobRecordSignedOffAt || '',
        jobRecordSignedOffBy: job.jobRecordSignedOffBy || '',
        jobRecordSignedOffNotes: job.jobRecordSignedOffNotes || '',
        customerSignature: job.customerSignature || (job as any).workflowState?.customerSignature || null,
        customerSignatureName: job.customerSignatureName || (job as any).workflowState?.customerSignatureName || null,
        siteManagerSignature: job.siteManagerSignature || (job as any).workflowState?.siteManagerSignature || null,
        siteManagerName: job.siteManagerName || (job as any).workflowState?.siteManagerName || null,
        techSignature: job.techSignature || (job as any).workflowState?.techSignature || null,
        techSignatureName: job.techSignatureName || (job as any).workflowState?.techSignatureName || null,
        signature: job.signature || job.customerSignature || job.siteManagerSignature || (job as any).workflowState?.signature || null,
        signerName: job.signerName || job.customerSignatureName || job.siteManagerName || (job as any).workflowState?.signerName || null,
        signatureTimestamp: job.signatureTimestamp || (job as any).workflowState?.signatureTimestamp || null
    } as any);

    
    const assets = useMemo(() => {
        const customer = state.customers.find(c => c.id === job.customerId);
        let customerEquipment = customer?.equipment || [];
        
        const getAssetId = (e: any) => e.id || e.equipmentId || e._id || e.assetTag || e.name || '';
        
        // Find all equipment IDs associated with this job's unitStates, files, or equipmentIds
        const requiredAssetIds = new Set([
            ...(job.unitStates?.map(s => s.assetId).filter(Boolean) || []),
            ...(job.files?.map(f => f.metadata?.assetId || f.assetId).filter(Boolean) || []),
            ...(job.equipmentIds?.filter(Boolean) || [])
        ]);

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
        
        let filteredEquipment = customerEquipment;
        if (currentPropertyId) {
            // Only show assets mapped to this property or its sub-locations.
            // If the customer has multiple locations, prevent unmapped assets from carrying over between them.
            const hasMultipleLocations = (customer?.serviceLocations?.length || 0) > 1;
            const validPropertyIds = customer?.serviceLocations
                ? getSubLocationIds(currentPropertyId, customer.serviceLocations)
                : [currentPropertyId];
            filteredEquipment = customerEquipment.filter(e => (e.propertyId && validPropertyIds.includes(e.propertyId)) || (!hasMultipleLocations && !e.propertyId));
        } else if (customer?.serviceLocations && customer.serviceLocations.length > 1) {
            // If we can't determine the property but there are multiple properties, 
            // only show unmapped equipment to be safe, rather than everything
            filteredEquipment = customerEquipment.filter(e => !e.propertyId);
        }

        // Ensure all equipment listed in unitStates or associated with photos is included, even if filtered out by locationId
        const finalEquipment = [...filteredEquipment];
        customerEquipment.forEach(e => {
            const eId = getAssetId(e);
            if (eId && requiredAssetIds.has(eId) && !finalEquipment.some(fe => getAssetId(fe) === eId)) {
                finalEquipment.push(e);
            }
        });

        // Fallback for any requiredAssetId that does not exist in customer equipment at all
        requiredAssetIds.forEach(assetId => {
            if (assetId && !finalEquipment.some(fe => getAssetId(fe) === assetId)) {
                const us = job.unitStates?.find(s => s.assetId === assetId);
                finalEquipment.push({
                    id: assetId,
                    name: us?.assetTag ? `Unit ${us.assetTag}` : `System #${assetId.slice(-4).toUpperCase()}`,
                    type: 'Equipment Unit',
                    brand: 'Serviced System',
                    condition: us?.health || us?.healthBefore || 'Good'
                } as any);
            }
        });
        
        return finalEquipment.map((e, idx) => ({
            ...e,
            id: getAssetId(e) || `unit-${idx + 1}`
        }));
    }, [state.customers, job.customerId, job.locationId, job.address, job.unitStates, job.files, job.equipmentIds]);

    const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
    const [isChecklistsModalOpen, setIsChecklistsModalOpen] = useState(false);
    const [isProposalsModalOpen, setIsProposalsModalOpen] = useState(false);
    const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
    
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
        type: 'Air Handler',
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
        volts: '',
        amps: '',
        seerRating: '',
        filterType: '',
        blowerType: ''
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
                type: 'Air Handler',
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
                volts: '',
                amps: '',
                seerRating: '',
                filterType: '',
                blowerType: ''
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

        const cleanGpsPin = (newAsset.gpsPin && typeof newAsset.gpsPin.lat === 'number' && typeof newAsset.gpsPin.lng === 'number' && !isNaN(newAsset.gpsPin.lat) && !isNaN(newAsset.gpsPin.lng) && (newAsset.gpsPin.lat !== 0 || newAsset.gpsPin.lng !== 0))
            ? { lat: Number(newAsset.gpsPin.lat), lng: Number(newAsset.gpsPin.lng) }
            : undefined;

        const activeAsset = {
            ...newAsset,
            gpsPin: cleanGpsPin,
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
            const seen = new Set((prev || []).map(f => f.id || f.dataUrl || f.url));
            const toAdd = newFiles.filter(f => {
                const key = f.id || f.dataUrl || f.url;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            const updated = [...prev, ...toAdd];
            onUpdate({ ...job, files: updated } as any);
            return updated;
        });
    };

    const removeFileFromJob = (fileToDelete: StoredFile) => {
        setFiles(prev => {
            const targetUrl = fileToDelete.url || fileToDelete.dataUrl;
            const updated = prev.filter(f => f.id !== fileToDelete.id && (!targetUrl || (f.url !== targetUrl && f.dataUrl !== targetUrl)));
            onUpdate({ ...job, files: updated } as any);
            return updated;
        });
    };

    const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
    const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState(false);
    const [payableAmount, setPayableAmount] = useState<number>(0);
    const [activeViewMode, setActiveViewMode] = useState<'dashboard' | 'stage'>('dashboard');
    
    // Tool Modals
    const [isLiveAssistOpen, setIsLiveAssistOpen] = useState(false);
    const [isWaiverOpen, setIsWaiverOpen] = useState(false);
    const [isSignOffOpen, setIsSignOffOpen] = useState(false);
    const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
    const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false);
    const [isSubBillOpen, setIsSubBillOpen] = useState(false);
    const [isJobRecordReviewOpen, setIsJobRecordReviewOpen] = useState(false);
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
                ? (Array.isArray(job.refrigerantLog) ? job.refrigerantLog : (job.refrigerantLog ? [job.refrigerantLog] : [])) : prevState.refrigerantLog;

            const newToolReadings = shouldUpdateObj(prevState.toolReadings, prevJob?.toolReadings, job.toolReadings)
                ? (Array.isArray(job.toolReadings) ? job.toolReadings : (job.toolReadings && typeof job.toolReadings === 'object' ? [job.toolReadings] : [])) : prevState.toolReadings;

            const newPartsUsed = shouldUpdateObj((prevState as any).partsUsed, (prevJob as any)?.partsUsed, (job as any).partsUsed)
                ? (Array.isArray((job as any).partsUsed) ? (job as any).partsUsed : ((job as any).partsUsed ? [(job as any).partsUsed] : [])) : (prevState as any).partsUsed;

            const newUnitStates = shouldUpdateObj(prevState.unitStates, prevJob?.unitStates, job.unitStates)
                ? (Array.isArray(job.unitStates) ? job.unitStates : (job.unitStates ? [job.unitStates] : [])) : prevState.unitStates;

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
                repairPostponedReason: newRepairPostponedReason,
                jobRecordSignedOff: shouldUpdate(prevState.jobRecordSignedOff, prevJob?.jobRecordSignedOff, job.jobRecordSignedOff) ? (job.jobRecordSignedOff || false) : prevState.jobRecordSignedOff,
                jobRecordSignedOffAt: shouldUpdate(prevState.jobRecordSignedOffAt, prevJob?.jobRecordSignedOffAt, job.jobRecordSignedOffAt) ? (job.jobRecordSignedOffAt || '') : prevState.jobRecordSignedOffAt,
                jobRecordSignedOffBy: shouldUpdate(prevState.jobRecordSignedOffBy, prevJob?.jobRecordSignedOffBy, job.jobRecordSignedOffBy) ? (job.jobRecordSignedOffBy || '') : prevState.jobRecordSignedOffBy,
                jobRecordSignedOffNotes: shouldUpdate(prevState.jobRecordSignedOffNotes, prevJob?.jobRecordSignedOffNotes, job.jobRecordSignedOffNotes) ? (job.jobRecordSignedOffNotes || '') : prevState.jobRecordSignedOffNotes,
                customerSignature: shouldUpdate(prevState.customerSignature, prevJob?.customerSignature, job.customerSignature) ? (job.customerSignature || null) : prevState.customerSignature,
                customerSignatureName: shouldUpdate(prevState.customerSignatureName, prevJob?.customerSignatureName, job.customerSignatureName) ? (job.customerSignatureName || null) : prevState.customerSignatureName,
                siteManagerSignature: shouldUpdate(prevState.siteManagerSignature, prevJob?.siteManagerSignature, job.siteManagerSignature) ? (job.siteManagerSignature || null) : prevState.siteManagerSignature,
                siteManagerName: shouldUpdate(prevState.siteManagerName, prevJob?.siteManagerName, job.siteManagerName) ? (job.siteManagerName || null) : prevState.siteManagerName,
                techSignature: shouldUpdate(prevState.techSignature, prevJob?.techSignature, job.techSignature) ? (job.techSignature || null) : prevState.techSignature,
                techSignatureName: shouldUpdate(prevState.techSignatureName, prevJob?.techSignatureName, job.techSignatureName) ? (job.techSignatureName || null) : prevState.techSignatureName,
                signature: shouldUpdate(prevState.signature, prevJob?.signature, job.signature) ? (job.signature || null) : prevState.signature,
                signerName: shouldUpdate(prevState.signerName, prevJob?.signerName, job.signerName) ? (job.signerName || null) : prevState.signerName,
                signatureTimestamp: shouldUpdate(prevState.signatureTimestamp, prevJob?.signatureTimestamp, job.signatureTimestamp) ? (job.signatureTimestamp || null) : prevState.signatureTimestamp
            };
        });
        // Safely merge incoming job.files without discarding locally captured or queued photos
        const incomingFiles = Array.isArray(job.files) ? job.files : [];
        setFiles(prevFiles => {
            const seen = new Set<string>();
            const merged: StoredFile[] = [];
            incomingFiles.forEach((f: any) => {
                const key = f.id || f.dataUrl || f.url;
                if (key && !seen.has(key)) {
                    seen.add(key);
                    merged.push(f);
                }
            });
            (prevFiles || []).forEach((f: any) => {
                const key = f.id || f.dataUrl || f.url;
                if (key && !seen.has(key)) {
                    seen.add(key);
                    merged.push(f);
                }
            });
            return merged;
        });

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
             const effectiveTaxRate = typeof targetInvoice.taxRate === 'number' ? targetInvoice.taxRate : 0;
             const taxAmount = typeof targetInvoice.taxAmount === 'number' ? targetInvoice.taxAmount : subtotal * effectiveTaxRate; 
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
            if (updates.files) {
                setFiles(updates.files);
            }
            if (updates.unitStates) {
                updateWorkflowState('unitStates', updates.unitStates);
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
                    organization: state.currentOrganization,
                    organizationId: job.organizationId || state.currentOrganization?.id || 'system',
                    bypassOptOut: true
                });
            } catch (err) {
                console.error("Failed to send email notification:", err);
            }
        }
        
        showToast.success("Started transit! Customer notified via SMS/Email.");
    };
    
    const handleJobRecordSignOff = async (signedOffBy: string, notes?: string) => {
        const nowStr = new Date().toISOString();
        setWorkflowState(prev => ({
            ...prev,
            jobRecordSignedOff: true,
            jobRecordSignedOffAt: nowStr,
            jobRecordSignedOffBy: signedOffBy,
            jobRecordSignedOffNotes: notes || ''
        }));
        const updates = {
            jobRecordSignedOff: true,
            jobRecordSignedOffAt: nowStr,
            jobRecordSignedOffBy: signedOffBy,
            jobRecordSignedOffNotes: notes || '',
            updatedAt: nowStr
        };
        try {
            if (!state.isDemoMode && job?.id) {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
            }
            dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
        } catch (err) {
            console.error("Failed to persist job record sign-off:", err);
        }
        showToast.success("Job record successfully signed off!");
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
            repairPostponedReason: workflowState.repairPostponedReason || '',
            jobRecordSignedOff: workflowState.jobRecordSignedOff || false,
            jobRecordSignedOffAt: workflowState.jobRecordSignedOffAt || '',
            jobRecordSignedOffBy: workflowState.jobRecordSignedOffBy || '',
            jobRecordSignedOffNotes: workflowState.jobRecordSignedOffNotes || '',
            customerSignature: workflowState.customerSignature !== undefined ? workflowState.customerSignature : (job.customerSignature || null),
            customerSignatureName: workflowState.customerSignatureName !== undefined ? workflowState.customerSignatureName : (job.customerSignatureName || null),
            siteManagerSignature: workflowState.siteManagerSignature !== undefined ? workflowState.siteManagerSignature : (job.siteManagerSignature || null),
            siteManagerName: workflowState.siteManagerName !== undefined ? workflowState.siteManagerName : (job.siteManagerName || null),
            techSignature: workflowState.techSignature !== undefined ? workflowState.techSignature : (job.techSignature || null),
            techSignatureName: workflowState.techSignatureName !== undefined ? workflowState.techSignatureName : (job.techSignatureName || null),
            signature: (workflowState.customerSignature || workflowState.siteManagerSignature || workflowState.signature) !== undefined 
                ? (workflowState.customerSignature || workflowState.siteManagerSignature || workflowState.signature || null) 
                : (job.signature || null),
            signerName: (workflowState.customerSignatureName || workflowState.siteManagerName || workflowState.signerName) !== undefined 
                ? (workflowState.customerSignatureName || workflowState.siteManagerName || workflowState.signerName || null) 
                : (job.signerName || null),
            signatureTimestamp: workflowState.signatureTimestamp !== undefined ? workflowState.signatureTimestamp : (job.signatureTimestamp || null),
            preWorkWaiverSignature: workflowState.preWorkWaiverSignature || job.preWorkWaiverSignature || null,
            preWorkWaiverSignedAt: workflowState.preWorkWaiverSignedAt || job.preWorkWaiverSignedAt || null,
            preWorkWaiverTitle: workflowState.preWorkWaiverTitle || job.preWorkWaiverTitle || null,
            workflowState: {
                ...(job.workflowState || {}),
                ...workflowState
            }
        };

        
        // Ensure customer record is also updated with new potential address, email, and phone
        const customer = state.customers.find(c => c.id === job.customerId);
        if (customer) {
             const customerUpdates: any = {};
             let doUpdate = false;
             
             // Sync equipment health back to customer equipment conditions
             const localEquipment = customer.equipment || [];
             let equipmentUpdated = false;
             
             const getEqId = (e: any) => e.id || e.equipmentId || e._id || e.assetTag;
             const todayStr = new Date().toISOString().split('T')[0];
             const updatedEquipment = localEquipment.map((eq: EquipmentAsset) => {
                 const eqId = getEqId(eq);
                 const stateForEq: any = workflowState.unitStates?.find(s => s.assetId === eqId || (eq.id && s.assetId === eq.id));
                 let eqToReturn = eq;
                 if (stateForEq && (stateForEq.healthAfter || stateForEq.health || stateForEq.healthBefore)) {
                     const newCondition = (stateForEq.healthAfter || stateForEq.health || stateForEq.healthBefore) as EquipmentAsset['condition'];
                     if (eq.condition !== newCondition) {
                         equipmentUpdated = true;
                         eqToReturn = { ...eqToReturn, condition: newCondition };
                     }
                 }
                 // When equipment was serviced or inspected in this job workflow, also update its lastMaintenanceDate
                 const isServiced = Boolean(
                     stateForEq || 
                     (job.equipmentIds && (job.equipmentIds.includes(eqId) || (eq.id && job.equipmentIds.includes(eq.id))))
                 );
                 if (isServiced) {
                     const existingWarranty = eqToReturn.warranty || {};
                     if (existingWarranty.lastMaintenanceDate !== todayStr) {
                         equipmentUpdated = true;
                         eqToReturn = {
                             ...eqToReturn,
                             warranty: {
                                 ...existingWarranty,
                                 lastMaintenanceDate: todayStr
                             }
                         };
                     }
                 }
                 return eqToReturn;
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
             
             // Also add as a ServiceLocation if it exists and job is not already linked to an existing location
             if (workflowState.customerDetails.address && !job.locationId) {
                 const currentLocations = customer.serviceLocations ? [...customer.serviceLocations] : [];
                 const cleanNewAddr = workflowState.customerDetails.address.split(',')[0].trim().toLowerCase();
                 const alreadyExists = currentLocations.some((loc: any) => {
                     if (!loc.address) return false;
                     const cleanExisting = loc.address.split(',')[0].trim().toLowerCase();
                     return cleanExisting === cleanNewAddr || cleanNewAddr.includes(cleanExisting) || cleanExisting.includes(cleanNewAddr);
                 });
                 if (!alreadyExists && cleanNewAddr.length > 5) {
                     currentLocations.push({ 
                         id: `loc-${Date.now()}`, 
                         name: (customer.customerType === 'Commercial' || customer.customerType === 'Property Management')
                             ? `${customer.name} - ${workflowState.customerDetails.address.split(',')[0].trim()}`
                             : 'Service Location', 
                         address: workflowState.customerDetails.address 
                     });
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
                    showToast.info("Scanning data plate with AI Vision...");
                    const ocrData = await scanDataPlatePhoto(file, {
                        brand: newAsset.brand,
                        model: newAsset.model,
                        serial: newAsset.serial,
                        year: newAsset.year,
                        tonnage: newAsset.tonnage,
                        refrigerantType: newAsset.refrigerantType,
                        electricityType: newAsset.electricityType,
                        seerRating: newAsset.seerRating
                    });

                    setNewAsset(prev => ({
                        ...prev,
                        [photoType]: downloadUrl,
                        type: prev.type && prev.type !== 'System' && prev.type !== 'Equipment' && prev.type.trim() !== '' ? prev.type : (ocrData.type || prev.type),
                        brand: prev.brand && prev.brand.trim() !== '' ? prev.brand : (ocrData.brand || prev.brand),
                        model: prev.model && prev.model.trim() !== '' ? prev.model : (ocrData.model || prev.model),
                        serial: prev.serial && prev.serial.trim() !== '' ? prev.serial : (ocrData.serial || prev.serial),
                        year: prev.year && prev.year.trim() !== '' ? prev.year : (ocrData.year || prev.year),
                        tonnage: prev.tonnage ? prev.tonnage : (ocrData.tonnage ? Number(ocrData.tonnage) : prev.tonnage),
                        refrigerantType: prev.refrigerantType && prev.refrigerantType.trim() !== '' ? prev.refrigerantType : (ocrData.refrigerantType || prev.refrigerantType),
                        refrigerantCharge: prev.refrigerantCharge && prev.refrigerantCharge.trim() !== '' ? prev.refrigerantCharge : (ocrData.refrigerantCharge || prev.refrigerantCharge),
                        btuCapacity: prev.btuCapacity && prev.btuCapacity.trim() !== '' ? prev.btuCapacity : (ocrData.btuCapacity || prev.btuCapacity),
                        heatType: prev.heatType && prev.heatType.trim() !== '' ? prev.heatType : (ocrData.heatType || prev.heatType),
                        electricityType: prev.electricityType && prev.electricityType.trim() !== '' ? prev.electricityType : (ocrData.electricityType || prev.electricityType),
                        volts: prev.volts && prev.volts.trim() !== '' ? prev.volts : (ocrData.volts || prev.volts),
                        amps: prev.amps && prev.amps.trim() !== '' ? prev.amps : (ocrData.amps || prev.amps),
                        phase: prev.phase && prev.phase.trim() !== '' ? prev.phase : (ocrData.phase || prev.phase),
                        seerRating: prev.seerRating && prev.seerRating.trim() !== '' ? prev.seerRating : (ocrData.seerRating || prev.seerRating),
                        filterType: prev.filterType && prev.filterType.trim() !== '' ? prev.filterType : (ocrData.filterType || prev.filterType),
                        compressorType: prev.compressorType && prev.compressorType.trim() !== '' ? prev.compressorType : (ocrData.compressorType || prev.compressorType),
                        blowerType: prev.blowerType && prev.blowerType.trim() !== '' ? prev.blowerType : (ocrData.blowerType || prev.blowerType),
                        systemGroupRole: prev.systemGroupRole && prev.systemGroupRole.trim() !== '' ? prev.systemGroupRole : (ocrData.systemGroupRole || prev.systemGroupRole)
                    }));
                    showToast.success("AI Vision Scan Complete! Form pre-filled (manual entries preserved).");
                } catch (ocrErr) {
                    console.error("AI Vision OCR Failed:", ocrErr);
                    setNewAsset(prev => ({
                        ...prev,
                        [photoType]: downloadUrl
                    }));
                } finally {
                    setIsOcrScanning(false);
                }
            } else {
                setNewAsset(prev => ({
                    ...prev,
                    [photoType]: downloadUrl
                }));
            }

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

            const prompt = `You are an expert HVAC, Electrical, & Industrial Equipment Master AI.
Research, decode, and derive technical specifications for this unit:
- Brand/Manufacturer: ${brand}
- Model Number: ${model}
- Serial Number: ${serial}

Rules for Decoding & Specs Retrieval:
1. "type": Classify unit type accurately based on model nomenclature or manufacturer specs (e.g. "Air Handler", "Condenser", "Package Unit", "Furnace", "Heat Pump", "Compressor", "Chiller", "Boiler", "Water Heater", "Generator", "Mini Split").
2. "year": Decode manufacturing year from serial date code structure (e.g. Carrier week/year, Trane date code, York letter code, Rheem year digits) OR estimate era based on model series. E.g. "2018".
3. "tonnage": Decode cooling capacity in TONS. Look for nominal MBH in model (018=1.5, 024=2.0, 030=2.5, 036=3.0, 042=3.5, 048=4.0, 060=5.0, 072=6.0, 090=7.5, 120=10.0). ALWAYS return capacity in TONS as a decimal (e.g. 3.0, 4.0), NEVER as raw MBH (like 36 or 48).
4. "refrigerantType": Identify standard refrigerant for this brand/model series (e.g. R-410A, R-22, R-454B, R-134a, R-404A).
5. "refrigerantCharge": Factory refrigerant charge if standard for this model (e.g. "5 lbs 8 oz", "104 oz").
6. "btuCapacity": Nominal BTU capacity (e.g. "36000 BTU/h").
7. "heatType": E.g. "Gas", "Electric", "Heat Pump", "Hydronic", "N/A".
8. "seerRating": Standard SEER / SEER2 rating for this model series (e.g. "14", "16", "18", "21").
9. "electricityType": Electrical voltage & phase (e.g. "208-230V / 1ph", "460V / 3ph", "115V / 1ph").
10. "volts": Voltage rating (e.g. "208-230V").
11. "amps": FLA / MCA / Max Fuse Amps (e.g. "18.5A FLA / 25A Max Fuse").
12. "phase": Electrical phase (e.g. "1Ph", "3Ph").
13. "filterType": Standard filter size for this cabinet size (e.g. "20x25x1 MERV 11").
14. "compressorType": Compressor design style if outdoor/package unit (e.g. "Scroll", "Reciprocating", "Inverter").
15. "blowerType": Blower motor design if air handler/furnace (e.g. "ECM Variable Speed", "PSC").
16. "systemGroupRole": Suggested role in system (e.g. "Evaporator", "Condensing Unit", "Compressor", "Controller").

Return ONLY a valid JSON object matching this schema with NO markdown wrapper:
{
  "type": string | null,
  "year": string | null,
  "tonnage": number | null,
  "refrigerantType": string | null,
  "refrigerantCharge": string | null,
  "btuCapacity": string | null,
  "heatType": string | null,
  "seerRating": string | null,
  "electricityType": string | null,
  "volts": string | null,
  "amps": string | null,
  "phase": string | null,
  "filterType": string | null,
  "compressorType": string | null,
  "blowerType": string | null,
  "systemGroupRole": string | null
}`;

            const result: any = await callGeminiAI({
                prompt,
                modelName: 'gemini-3.7-flash',
                config: { temperature: 0.1, response_mime_type: 'application/json' }
            });

            const cleanJson = (result.data?.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const specs = JSON.parse(cleanJson);

            if (specs.tonnage !== undefined && specs.tonnage !== null) {
                let numT = typeof specs.tonnage === 'number' ? specs.tonnage : parseFloat(String(specs.tonnage));
                if (!isNaN(numT) && numT >= 12 && numT <= 600 && numT % 6 === 0) {
                    specs.tonnage = Math.round((numT / 12) * 10) / 10;
                }
            }

            const hasSpecs = Object.values(specs).some(val => val !== null && val !== undefined && val !== '');

            if (!hasSpecs) {
                showToast.warn("No verified specifications could be determined for this model/serial.");
                setIsResearching(false);
                return;
            }

            const updatedAsset = { ...newAsset };
            let count = 0;

            if (specs.type && (!updatedAsset.type || updatedAsset.type === 'System' || updatedAsset.type === 'Equipment' || updatedAsset.type.trim() === '')) {
                updatedAsset.type = specs.type;
                count++;
            }
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
            if (specs.refrigerantCharge && !updatedAsset.refrigerantCharge) {
                updatedAsset.refrigerantCharge = specs.refrigerantCharge;
                count++;
            }
            if (specs.btuCapacity && !updatedAsset.btuCapacity) {
                updatedAsset.btuCapacity = specs.btuCapacity;
                count++;
            }
            if (specs.heatType && !updatedAsset.heatType) {
                updatedAsset.heatType = specs.heatType;
                count++;
            }
            if (specs.seerRating && !updatedAsset.seerRating) {
                updatedAsset.seerRating = specs.seerRating;
                count++;
            }
            if (specs.electricityType && !updatedAsset.electricityType) {
                updatedAsset.electricityType = specs.electricityType;
                count++;
            }
            if (specs.volts && !updatedAsset.volts) {
                updatedAsset.volts = specs.volts;
                count++;
            }
            if (specs.amps && !updatedAsset.amps) {
                updatedAsset.amps = specs.amps;
                count++;
            }
            if (specs.phase && !updatedAsset.phase) {
                updatedAsset.phase = specs.phase;
                count++;
            }
            if (specs.filterType && !updatedAsset.filterType) {
                updatedAsset.filterType = specs.filterType;
                count++;
            }
            if (specs.compressorType && !updatedAsset.compressorType) {
                updatedAsset.compressorType = specs.compressorType;
                count++;
            }
            if (specs.blowerType && !updatedAsset.blowerType) {
                updatedAsset.blowerType = specs.blowerType;
                count++;
            }
            if (specs.systemGroupRole && !updatedAsset.systemGroupRole) {
                updatedAsset.systemGroupRole = specs.systemGroupRole;
                count++;
            }

            setNewAsset(updatedAsset);
            setIsResearching(false);

            if (count > 0) {
                showToast.success(`AI Specs Research complete! Auto-filled ${count} technical specifications (including Equipment Type).`);
            } else {
                showToast.info("AI Research complete. All verified specs are already filled out.");
            }
        } catch (err) {
            console.error(err);
            showToast.error("Failed to research unit specifications.");
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

            const prompt = `You are an expert HVAC, Electrical, & Industrial Equipment Master AI.
Research, decode, and derive technical specifications for this Air Handler / Fan Coil unit:
- Brand/Manufacturer: ${brand}
- Model Number: ${model}
- Serial Number: ${serial}

Rules for Decoding & Specs Retrieval:
1. "type": Return "Air Handler" or specific fan coil type (e.g. "Fan Coil Unit", "Multi-Position Air Handler").
2. "year": Decode manufacturing year from serial date code structure OR estimate era based on model series. E.g. "2018".
3. "tonnage": Decode cooling capacity in TONS. Look for nominal MBH in model (018=1.5, 024=2.0, 030=2.5, 036=3.0, 042=3.5, 048=4.0, 060=5.0, 072=6.0, 090=7.5, 120=10.0). ALWAYS return capacity in TONS as a decimal (e.g. 3.0, 4.0), NEVER as raw MBH (like 36 or 48).
4. "refrigerantType": Identify standard refrigerant for this brand/model series (e.g. R-410A, R-22, R-454B, R-134a, R-404A).
5. "heatType": E.g. "Electric", "Gas", "Heat Pump", "Hydronic", "N/A".
6. "seerRating": Standard SEER / SEER2 rating for this model series (e.g. "14", "16", "18", "21").
7. "electricityType": Electrical voltage & phase (e.g. "208-230V / 1ph", "460V / 3ph", "115V / 1ph").
8. "volts": Voltage rating (e.g. "208-230V").
9. "amps": FLA / MCA / Max Fuse Amps.
10. "filterType": Standard filter size for this cabinet size (e.g. "20x25x1 MERV 11").
11. "blowerType": Blower motor design (e.g. "ECM Variable Speed", "PSC").

Return ONLY a valid JSON object matching this schema with NO markdown wrapper:
{
  "type": string | null,
  "year": string | null,
  "tonnage": number | null,
  "refrigerantType": string | null,
  "heatType": string | null,
  "seerRating": string | null,
  "electricityType": string | null,
  "volts": string | null,
  "amps": string | null,
  "filterType": string | null,
  "blowerType": string | null
}`;

            const result: any = await callGeminiAI({
                prompt,
                modelName: 'gemini-3.7-flash',
                config: { temperature: 0.1, response_mime_type: 'application/json' }
            });

            const cleanJson = (result.data?.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
            const specs = JSON.parse(cleanJson);

            if (specs.tonnage !== undefined && specs.tonnage !== null) {
                let numT = typeof specs.tonnage === 'number' ? specs.tonnage : parseFloat(String(specs.tonnage));
                if (!isNaN(numT) && numT >= 12 && numT <= 600 && numT % 6 === 0) {
                    specs.tonnage = Math.round((numT / 12) * 10) / 10;
                }
            }

            const hasSpecs = Object.values(specs).some(val => val !== null && val !== undefined && val !== '');

            if (!hasSpecs) {
                showToast.warn("No verified specifications could be determined for this model/serial.");
                setIsResearchingAirHandler(false);
                return;
            }

            const updatedDetails = { ...airHandlerDetails };
            let count = 0;

            if (specs.type && (!updatedDetails.type || updatedDetails.type === 'System' || updatedDetails.type === 'Equipment' || updatedDetails.type.trim() === '')) {
                updatedDetails.type = specs.type;
                count++;
            } else if (!updatedDetails.type) {
                updatedDetails.type = "Air Handler";
            }
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
            if (specs.volts && !updatedDetails.volts) {
                updatedDetails.volts = specs.volts;
                count++;
            }
            if (specs.amps && !updatedDetails.amps) {
                updatedDetails.amps = specs.amps;
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
            if (specs.blowerType && !updatedDetails.blowerType) {
                updatedDetails.blowerType = specs.blowerType;
                count++;
            }

            setAirHandlerDetails(updatedDetails);
            if (count > 0) {
                showToast.success(`Successfully populated ${count} technical specifications for the Air Handler!`);
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
        try {
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
            showToast.success("Asset saved!");
        } catch (err: any) {
            console.error("Failed to save asset:", err);
            showToast.error("Failed to save asset: " + (err?.message || "Unknown error"));
        } finally {
            setIsAddAssetOpen(false);
            setNewAsset({ brand: '', model: '', serial: '', type: 'System' });
        }
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
        const hasExistingSignOff = !!(
            workflowState.jobRecordSignedOff ||
            workflowState.customerSignature ||
            workflowState.signature ||
            workflowState.siteManagerSignature ||
            workflowState.techSignature ||
            job.customerSignature ||
            job.signature ||
            job.siteManagerSignature ||
            job.techSignature ||
            job.signOffSheetUrl ||
            (job as any)?.signoffSheetUrl ||
            (job as any)?.signOff?.sheetUrl ||
            (job?.invoice as any)?.signatureUrl ||
            job.invoiceSignature
        );

        if (!workflowState.jobRecordSignedOff) {
            if (hasExistingSignOff) {
                workflowState.jobRecordSignedOff = true;
                workflowState.jobRecordSignedOffAt = new Date().toISOString();
                workflowState.jobRecordSignedOffBy = state.currentUser?.name || 'Technician';
            } else {
                showToast.warn("Technician Sign-Off Required: Please review and sign off on the full job record before closing this job.");
                setIsJobRecordReviewOpen(true);
                return;
            }
        }

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

        const isReviewPending = !workflowState.repairPostponed;
        const checkoutUpdates: any = {
            jobStatus: (workflowState.repairPostponed ? 'Needs Follow-up' : 'Needs Review') as any,
            needsAdminVerification: isReviewPending ? true : undefined,
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

        // Auto-generate mileage log for this completed job if not logged yet
        try {
            const existingJobLog = (state.vehicleLogs || []).find((l: any) => l.jobId === job.id || (l.notes && l.notes.includes(job.id)));
            if (!existingJobLog && state.currentUser?.id) {
                const jobSiteAddr = job.customerName || job.locationName || job.address || 'Service Site';
                const woId = job.poNumber || job.id.slice(-6).toUpperCase();
                const autoLogId = `vlog_job_${Date.now()}`;
                
                let jobMiles = 15.0;
                if (jobSiteCoords && (state.currentUser as any)?.lastLocation) {
                    const R = 3958.8;
                    const lastLoc = (state.currentUser as any).lastLocation;
                    const dLat = (jobSiteCoords.lat - lastLoc.latitude) * Math.PI / 180;
                    const dLon = (jobSiteCoords.lng - lastLoc.longitude) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lastLoc.latitude * Math.PI / 180) * Math.cos(jobSiteCoords.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const calculatedDist = R * c;
                    if (!isNaN(calculatedDist) && calculatedDist > 0) {
                        jobMiles = Math.round(calculatedDist * 10) / 10;
                    }
                }

                const vehicleLogEntry = {
                    id: autoLogId,
                    userId: state.currentUser.id,
                    userName: state.currentUser.name || `${state.currentUser.firstName || ''} ${state.currentUser.lastName || ''}`.trim() || 'Technician',
                    vehicleId: (state.currentUser as any)?.assignedVehicleId || 'default-truck',
                    vehicleName: (state.currentUser as any)?.assignedVehicleName || 'Service Van',
                    jobId: job.id,
                    poNumber: woId,
                    startMiles: 0,
                    endMiles: jobMiles,
                    totalMiles: jobMiles,
                    purpose: 'job',
                    destination: jobSiteAddr,
                    notes: `Auto-logged site visit miles for WO #${woId}`,
                    date: new Date().toISOString().split('T')[0],
                    createdAt: nowStr,
                    organizationId: job.organizationId || state.currentOrganization?.id || 'unaffiliated'
                };

                await db.collection('vehicleLogs').doc(autoLogId).set(cleanUndefinedFields(vehicleLogEntry)).catch(console.error);
            }
        } catch (vLogErr) {
            console.warn("Could not auto-generate vehicle log for job checkout:", vLogErr);
        }

        // Notify admins if job requires review
        if (isReviewPending) {
            const techName = state.currentUser?.name || `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Technician';
            notifyAdminsJobPendingReview(job, techName, job.organizationId || state.currentOrganization?.id || '');
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
        const hasExistingSignOff = !!(
            workflowState.jobRecordSignedOff ||
            workflowState.customerSignature ||
            workflowState.signature ||
            workflowState.siteManagerSignature ||
            workflowState.techSignature ||
            job.customerSignature ||
            job.signature ||
            job.siteManagerSignature ||
            job.techSignature ||
            job.signOffSheetUrl ||
            (job as any)?.signoffSheetUrl ||
            (job as any)?.signOff?.sheetUrl ||
            (job?.invoice as any)?.signatureUrl ||
            job.invoiceSignature
        );

        if (!workflowState.jobRecordSignedOff) {
            if (hasExistingSignOff) {
                workflowState.jobRecordSignedOff = true;
                workflowState.jobRecordSignedOffAt = new Date().toISOString();
                workflowState.jobRecordSignedOffBy = state.currentUser?.name || 'Technician';
            } else {
                showToast.warn("Technician Sign-Off Required: Please review and sign off on the full job record before completing this job.");
                setIsJobRecordReviewOpen(true);
                return;
            }
        }

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
            const orgId = job.organizationId || state.currentOrganization?.id || state.currentUser?.organizationId || 'default';
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
            const orgId = job.organizationId || state.currentOrganization?.id || state.currentUser?.organizationId || 'default';
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
        updateWorkflowState('toolReadings', [...(Array.isArray(workflowState.toolReadings) ? workflowState.toolReadings : []), reading]);
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
    const [cameraAssetId, setCameraAssetId] = useState<string | null>(null);

    const handleNativeCameraTrigger = async (label?: string, targetAssetId?: string) => {
        const resolvedLabel = label || (step >= 3 ? 'After' : 'Before');
        setCameraLabel(resolvedLabel);
        setCameraAssetId(targetAssetId || null);
        console.log("HANDLE_NATIVE_CAMERA_TRIGGERED", resolvedLabel, "Asset:", targetAssetId);
        
        try {
            const isNative = Capacitor.isNativePlatform();
            
            if (isNative) {
                const image = await Camera.getPhoto({
                    quality: 65,
                    allowEditing: false,
                    resultType: CameraResultType.DataUrl,
                    source: CameraSource.Camera,
                    saveToGallery: false
                });

                if (image.dataUrl) {
                    const response = await fetch(image.dataUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    await processCapturedFile(file, resolvedLabel, targetAssetId);
                    showToast.success("Photo saved! Tap Camera to snap another, or Gallery to select multiple.");
                }
            } else {
                // On Web, show our custom camera modal with live preview & continuous snapping
                setIsWebCameraOpen(true);
            }
        } catch (e: any) {
            console.error("Camera error:", e);
            const msg = (e?.message || '').toLowerCase();
            if (msg.includes('cancel') || msg.includes('dismiss')) {
                return;
            }
            // Fallback to custom camera modal
            setIsWebCameraOpen(true);
        }
    };

    const handlePickGalleryImages = async (label?: string, targetAssetId?: string) => {
        const resolvedLabel = label || (step >= 3 ? 'After' : 'Before');
        setCameraLabel(resolvedLabel);
        setCameraAssetId(targetAssetId || null);
        try {
            const isNative = Capacitor.isNativePlatform();
            if (isNative) {
                const result = await Camera.pickImages({
                    quality: 75,
                    limit: 0
                });
                if (result.photos && result.photos.length > 0) {
                    showToast.info(`Selected ${result.photos.length} photo(s). Uploading...`);
                    const filePromises = result.photos.map(async (photo, idx) => {
                        const response = await fetch(photo.webPath);
                        const blob = await response.blob();
                        return new File([blob], `gallery_${Date.now()}_${idx}.jpg`, { type: 'image/jpeg' });
                    });
                    const convertedFiles = await Promise.all(filePromises);
                    await handleBatchPhotoFiles(convertedFiles, resolvedLabel, targetAssetId);
                }
            } else {
                if (cameraInputRef.current) {
                    cameraInputRef.current.click();
                }
            }
        } catch (err: any) {
            const msg = (err?.message || '').toLowerCase();
            if (!msg.includes('cancel') && !msg.includes('dismiss')) {
                console.error("Gallery pick error:", err);
                showToast.error("Failed to pick photos: " + (err.message || "Unknown error"));
            }
        }
    };

    const handleNativeAssetCameraTrigger = async (photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl') => {
        try {
            const isNative = Capacitor.isNativePlatform();
            
            if (isNative) {
                const image = await Camera.getPhoto({
                    quality: 65,
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
            const msg = (e?.message || '').toLowerCase();
            if (msg.includes('cancel') || msg.includes('dismiss')) {
                return;
            }
            setAssetCameraTarget(photoType);
            setIsWebCameraOpen(true);
        }
    };

    const handlePickNativeAssetGallery = async (photoType: 'serialPhotoUrl' | 'unitTagPhotoUrl' | 'conditionPhotoUrl' | 'wideLocationPhotoUrl' | 'accessPointPhotoUrl' | 'qrCodePhotoUrl') => {
        try {
            if (Capacitor.isNativePlatform()) {
                const result = await Camera.pickImages({
                    quality: 80,
                    limit: 1
                });
                if (result.photos && result.photos.length > 0) {
                    const response = await fetch(result.photos[0].webPath);
                    const blob = await response.blob();
                    const file = new File([blob], `${photoType}_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    await handleAssetPhotoUpload(mockEvent, photoType);
                    return;
                }
            }
        } catch (err: any) {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('cancel') || msg.includes('dismiss')) return;
            console.warn("Asset gallery pick warning:", err);
        }
        // Fallback to hidden file input
        const fileInput = document.getElementById(`asset-file-input-${photoType}`) as HTMLInputElement;
        fileInput?.click();
    };

    const processCapturedFile = async (file: File, label: string, targetAssetId?: string) => {
        setIsSaving(true);
        try {
            const orgId = job.organizationId || state.currentOrganization?.id || state.currentUser?.organizationId || 'default';
            const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : 'upload.jpg';
            const path = `organizations/${orgId}/jobs/${job.id}/workflowFiles/${Date.now()}_${safeName}`;
            const newFileId = `file-${Date.now()}`;
            const timestamp = new Date().toISOString();
            const userName = `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Technician';

            // Auto-determine Before vs After phase based on active step if label is generic
            let resolvedLabel = label || 'Photo';
            const lowerLabel = resolvedLabel.toLowerCase().trim();
            const isExplicitAfter = lowerLabel.includes('after') || lowerLabel.includes('repair') || lowerLabel.includes('comp') || lowerLabel.includes('post') || lowerLabel.includes('fix') || lowerLabel.includes('done');
            const isExplicitBefore = lowerLabel.includes('before') || lowerLabel.includes('pre') || lowerLabel.includes('arrival') || lowerLabel.includes('diag');
            
            let phaseCategory = 'Before';
            if (isExplicitAfter) {
                phaseCategory = 'After';
            } else if (isExplicitBefore) {
                phaseCategory = 'Before';
            } else {
                phaseCategory = (step >= 3 || lowerLabel === 'after') ? 'After' : 'Before';
            }

            if (resolvedLabel === 'Photo' || resolvedLabel === 'Job Photo' || resolvedLabel === 'General' || resolvedLabel === 'Camera' || resolvedLabel === 'Gallery') {
                resolvedLabel = phaseCategory;
            }

            const assignedAssetId = targetAssetId || cameraAssetId || undefined;

            let downloadUrl = '';
            let isPendingUpload = false;

            if (typeof navigator !== 'undefined' && navigator.onLine) {
                try {
                    downloadUrl = await uploadFileToStorage(path, file);
                } catch (uploadErr) {
                    console.warn("[JobWorkflowModal] Storage upload failed, fallback to offline sync queue:", uploadErr);
                    isPendingUpload = true;
                }
            } else {
                isPendingUpload = true;
            }

            if (isPendingUpload || !downloadUrl) {
                try {
                    const fallbackDataUrl = await compressFile(file, 0.7);
                    downloadUrl = fallbackDataUrl;
                    await offlineSyncManager.registerPendingUpload({
                        id: newFileId,
                        jobId: job.id,
                        parentId: job.id,
                        parentCollection: 'jobs',
                        orgId: String(orgId),
                        storagePath: path,
                        dataUrl: fallbackDataUrl,
                        fileName: String(file.name || 'upload.jpg'),
                        fileType: String(file.type || 'image/jpeg'),
                        timestamp: Date.now(),
                        updateField: 'files'
                    });
                } catch (cErr) {
                    console.error("[JobWorkflowModal] Failed to process offline photo:", cErr);
                }
            }

            if (!downloadUrl) {
                throw new Error("Unable to upload or cache photo.");
            }

            const flatFile: StoredFile = {
                id: String(newFileId),
                organizationId: String(orgId),
                parentId: String(job.id),
                parentType: 'job',
                fileName: String(file.name || 'upload.jpg'),
                fileType: String(file.type || 'image/jpeg'),
                dataUrl: String(downloadUrl),
                url: String(downloadUrl),
                createdAt: String(timestamp),
                uploadedBy: String(userName),
                label: String(resolvedLabel),
                category: phaseCategory,
                phase: phaseCategory.toLowerCase(),
                ...(assignedAssetId ? { assetId: assignedAssetId } : {}),
                pendingUpload: isPendingUpload,
                metadata: {
                    label: String(resolvedLabel),
                    category: phaseCategory,
                    phase: phaseCategory.toLowerCase(),
                    ...(assignedAssetId ? { assetId: assignedAssetId } : {}),
                    pendingUpload: isPendingUpload
                }
            };

            const currentFiles = (files && files.length > 0) ? files : (job.files || []);
            const seen = new Set<string>();
            const cleanExisting = currentFiles.filter((f: any) => {
                const key = f.id || f.dataUrl || f.url;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            const updatedFiles = [...cleanExisting, flatFile];

            if (state.isDemoMode) {
                setFiles(updatedFiles);
                onUpdate({ ...job, files: updatedFiles } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields({
                    files: updatedFiles,
                    updatedAt: timestamp
                }));
                setFiles(updatedFiles);
                onUpdate({ ...job, files: updatedFiles } as any);
            }

            if (isPendingUpload) {
                showToast.info("Photo saved offline! It will upload automatically once connection is restored.");
            }

            // Auto-trigger AI Data Plate OCR when uploaded photo label matches data tag / plate keywords
            if (downloadUrl && (lowerLabel.includes('tag') || lowerLabel.includes('plate') || lowerLabel.includes('data') || lowerLabel.includes('serial'))) {
                scanDataPlatePhoto(downloadUrl, {
                    brand: newAsset.brand,
                    model: newAsset.model,
                    serial: newAsset.serial,
                    year: newAsset.year,
                    tonnage: newAsset.tonnage ? String(newAsset.tonnage) : undefined,
                    refrigerantType: newAsset.refrigerantType,
                    electricityType: newAsset.electricityType,
                    seerRating: newAsset.seerRating
                }).then(ocrData => {
                    if (ocrData && (ocrData.model || ocrData.serial || ocrData.brand || ocrData.tonnage || ocrData.year || ocrData.refrigerantType)) {
                        setNewAsset(prev => ({
                            ...prev,
                            unitTagPhotoUrl: prev.unitTagPhotoUrl || downloadUrl,
                            brand: prev.brand && prev.brand.trim() !== '' ? prev.brand : (ocrData.brand || prev.brand),
                            model: prev.model && prev.model.trim() !== '' ? prev.model : (ocrData.model || prev.model),
                            serial: prev.serial && prev.serial.trim() !== '' ? prev.serial : (ocrData.serial || prev.serial),
                            year: prev.year && prev.year.trim() !== '' ? prev.year : (ocrData.year || prev.year),
                            tonnage: prev.tonnage ? prev.tonnage : (ocrData.tonnage ? Number(ocrData.tonnage) : prev.tonnage),
                            refrigerantType: prev.refrigerantType && prev.refrigerantType.trim() !== '' ? prev.refrigerantType : (ocrData.refrigerantType || prev.refrigerantType),
                            electricityType: prev.electricityType && prev.electricityType.trim() !== '' ? prev.electricityType : (ocrData.electricityType || prev.electricityType),
                            seerRating: prev.seerRating && prev.seerRating.trim() !== '' ? prev.seerRating : (ocrData.seerRating || prev.seerRating)
                        }));
                        showToast.success("AI Data Plate Vision scanned photo! Equipment form auto-filled.");
                    }
                }).catch(ocrErr => console.warn("Auto data plate OCR scan warning:", ocrErr));
            }
        } catch (error) {
            console.error("Photo process failed:", error);
            showToast.error("Failed to save photo.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleBatchPhotoFiles = async (inputFiles: File[], label: string, targetAssetId?: string) => {
        if (inputFiles.length === 0) return;

        if (inputFiles.length === 1) {
            await processCapturedFile(inputFiles[0], label, targetAssetId);
            return;
        }

        setIsSaving(true);
        try {
            const orgId = job.organizationId || state.currentOrganization?.id || state.currentUser?.organizationId || 'default';
            const userName = `${state.currentUser?.firstName || ''} ${state.currentUser?.lastName || ''}`.trim() || 'Technician';

            let resolvedLabel = label || 'Photo';
            const lowerLabel = resolvedLabel.toLowerCase().trim();
            const isExplicitAfter = lowerLabel.includes('after') || lowerLabel.includes('repair') || lowerLabel.includes('comp') || lowerLabel.includes('post') || lowerLabel.includes('fix') || lowerLabel.includes('done');
            const isExplicitBefore = lowerLabel.includes('before') || lowerLabel.includes('pre') || lowerLabel.includes('arrival') || lowerLabel.includes('diag');

            let phaseCategory = 'Before';
            if (isExplicitAfter) {
                phaseCategory = 'After';
            } else if (isExplicitBefore) {
                phaseCategory = 'Before';
            } else {
                phaseCategory = (step >= 3 || lowerLabel === 'after') ? 'After' : 'Before';
            }

            if (resolvedLabel === 'Photo' || resolvedLabel === 'Job Photo' || resolvedLabel === 'General' || resolvedLabel === 'Camera' || resolvedLabel === 'Gallery') {
                resolvedLabel = phaseCategory;
            }

            const assignedAssetId = targetAssetId || cameraAssetId || undefined;
            const total = inputFiles.length;
            const newUploadedFiles: StoredFile[] = [];
            let offlineCount = 0;

            // Sequential processing to protect mobile memory and prevent cellular uplink saturation
            for (let i = 0; i < total; i++) {
                const file = inputFiles[i];
                showToast.info(`Optimizing and uploading photo ${i + 1} of ${total}...`);

                const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') : `upload_${i}.jpg`;
                const path = `organizations/${orgId}/jobs/${job.id}/workflowFiles/${Date.now()}_${i}_${safeName}`;
                const newFileId = `file-${Date.now()}-${i}`;
                const timestamp = new Date().toISOString();

                let downloadUrl = '';
                let isPendingUpload = false;

                if (typeof navigator !== 'undefined' && navigator.onLine) {
                    try {
                        downloadUrl = await uploadFileToStorage(path, file);
                    } catch (uploadErr) {
                        console.warn(`[JobWorkflowModal] Batch photo ${i + 1} upload failed, queuing for offline sync:`, uploadErr);
                        isPendingUpload = true;
                    }
                } else {
                    isPendingUpload = true;
                }

                if (isPendingUpload || !downloadUrl) {
                    try {
                        const fallbackDataUrl = await compressFile(file, 0.7);
                        downloadUrl = fallbackDataUrl;
                        offlineCount++;
                        await offlineSyncManager.registerPendingUpload({
                            id: newFileId,
                            jobId: job.id,
                            parentId: job.id,
                            parentCollection: 'jobs',
                            orgId: String(orgId),
                            storagePath: path,
                            dataUrl: fallbackDataUrl,
                            fileName: String(file.name || `upload_${i}.jpg`),
                            fileType: String(file.type || 'image/jpeg'),
                            timestamp: Date.now(),
                            updateField: 'files'
                        });
                    } catch (cErr) {
                        console.error(`[JobWorkflowModal] Failed to compress offline photo ${i + 1}:`, cErr);
                    }
                }

                if (downloadUrl) {
                    newUploadedFiles.push({
                        id: String(newFileId),
                        organizationId: String(orgId),
                        parentId: String(job.id),
                        parentType: 'job',
                        fileName: String(file.name || `upload_${i}.jpg`),
                        fileType: String(file.type || 'image/jpeg'),
                        dataUrl: String(downloadUrl),
                        url: String(downloadUrl),
                        createdAt: String(timestamp),
                        uploadedBy: String(userName),
                        label: String(resolvedLabel),
                        category: phaseCategory,
                        phase: phaseCategory.toLowerCase(),
                        ...(assignedAssetId ? { assetId: assignedAssetId } : {}),
                        pendingUpload: isPendingUpload,
                        metadata: {
                            label: String(resolvedLabel),
                            category: phaseCategory,
                            phase: phaseCategory.toLowerCase(),
                            ...(assignedAssetId ? { assetId: assignedAssetId } : {}),
                            pendingUpload: isPendingUpload
                        }
                    });
                }
            }

            if (newUploadedFiles.length === 0) {
                showToast.error("Failed to process selected photos.");
                return;
            }

            const currentFiles = (files && files.length > 0) ? files : (job.files || []);
            const seen = new Set<string>();
            const cleanExisting = currentFiles.filter((f: any) => {
                const key = f.id || f.dataUrl || f.url;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            const updatedFiles = [...cleanExisting, ...newUploadedFiles];

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

            if (offlineCount > 0) {
                showToast.success(`Saved ${newUploadedFiles.length} photo(s)! (${offlineCount} queued for auto-sync when online)`);
            } else {
                showToast.success(`Successfully uploaded all ${newUploadedFiles.length} photo(s)!`);
            }
        } catch (error) {
            console.error("Batch photo upload failed:", error);
            showToast.error("Failed to upload some photos. Please check your network connection.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, label: string) => {
        const inputFiles = Array.from(e.target.files || []);
        e.target.value = '';
        await handleBatchPhotoFiles(inputFiles, label, cameraAssetId || undefined);
    };

    const handleDeletePhoto = async (fileToDelete: StoredFile) => {
        if (!(await globalConfirm(t("Are you sure you want to delete this photo?"), t("Delete Photo"), t("Delete"), t("Cancel")))) return;
        
        setIsSaving(true);
        try {
            const targetId = fileToDelete.id;
            const targetUrl = fileToDelete.url || fileToDelete.dataUrl;

            // 1. Filter out all instances (including duplicates) by ID and URL
            const currentFiles = (files && files.length > 0) ? files : (job.files || []);
            const updatedFiles = currentFiles.filter(f => {
                if (targetId && f.id === targetId) return false;
                if (targetUrl && (f.url === targetUrl || f.dataUrl === targetUrl)) return false;
                return true;
            });

            // 2. Also clean up any unitStates referencing this photo
            const updatedUnitStates = (workflowState.unitStates || []).map((us: any) => {
                let changed = false;
                const newUs = { ...us };
                if (targetUrl && (newUs.beforePhotoUrl === targetUrl || newUs.beforePhotoDataUrl === targetUrl)) {
                    delete newUs.beforePhotoUrl;
                    delete newUs.beforePhotoDataUrl;
                    changed = true;
                }
                if (targetUrl && (newUs.afterPhotoUrl === targetUrl || newUs.afterPhotoDataUrl === targetUrl)) {
                    delete newUs.afterPhotoUrl;
                    delete newUs.afterPhotoDataUrl;
                    changed = true;
                }
                if (targetUrl && newUs.photoUrl === targetUrl) {
                    delete newUs.photoUrl;
                    changed = true;
                }
                if (Array.isArray(newUs.photos)) {
                    newUs.photos = newUs.photos.filter((p: any) => {
                        const pUrl = typeof p === 'string' ? p : (p?.url || p?.dataUrl);
                        return pUrl !== targetUrl && (!targetId || p?.id !== targetId);
                    });
                    changed = true;
                }
                return changed ? newUs : us;
            });

            const updates: any = {
                files: updatedFiles,
                unitStates: updatedUnitStates,
                updatedAt: new Date().toISOString()
            };

            // 3. Clean up any customer equipment referencing this photo
            const customer = state.customers?.find(c => c.id === job.customerId);
            if (customer && customer.id && targetUrl) {
                let eqChanged = false;
                const updatedCustomerEq = (customer.equipment || []).map((eq: any) => {
                    let changed = false;
                    const newEq = { ...eq };
                    if (newEq.unitTagPhotoUrl === targetUrl || newEq.unitTagPhotoDataUrl === targetUrl) {
                        delete newEq.unitTagPhotoUrl;
                        delete newEq.unitTagPhotoDataUrl;
                        changed = true;
                    }
                    if (newEq.dataPlatePhotoUrl === targetUrl || newEq.dataPlatePhotoDataUrl === targetUrl) {
                        delete newEq.dataPlatePhotoUrl;
                        delete newEq.dataPlatePhotoDataUrl;
                        changed = true;
                    }
                    if (newEq.photoUrl === targetUrl || newEq.photoDataUrl === targetUrl) {
                        delete newEq.photoUrl;
                        delete newEq.photoDataUrl;
                        changed = true;
                    }
                    if (newEq.serialPhotoUrl === targetUrl || newEq.serialPhotoDataUrl === targetUrl) {
                        delete newEq.serialPhotoUrl;
                        delete newEq.serialPhotoDataUrl;
                        changed = true;
                    }
                    if (newEq.conditionPhotoUrl === targetUrl || newEq.conditionPhotoDataUrl === targetUrl) {
                        delete newEq.conditionPhotoUrl;
                        delete newEq.conditionPhotoDataUrl;
                        changed = true;
                    }
                    if (changed) eqChanged = true;
                    return changed ? newEq : eq;
                });

                if (eqChanged) {
                    if (!state.isDemoMode) {
                        await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ equipment: updatedCustomerEq }));
                    }
                    dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: updatedCustomerEq } });
                }
            }

            if (state.isDemoMode) {
                setFiles(updatedFiles);
                updateWorkflowState('unitStates', updatedUnitStates);
                onUpdate({ ...job, ...updates } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
                setFiles(updatedFiles);
                updateWorkflowState('unitStates', updatedUnitStates);
                onUpdate({ ...job, ...updates } as any);
            }
            showToast.success(t("Photo deleted successfully."));
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
            const targetAssetId = assetId ? assetId.trim() : '';
            const assignedAsset = assets?.find(a => a.id === targetAssetId);
            const unitTag = assignedAsset?.name || (assignedAsset as any)?.title || '';

            const currentFiles = (files && files.length > 0) ? files : (job.files || []);
            const updatedFiles = currentFiles.map(f => {
                if (f.id === fileId || f.dataUrl === fileId || f.url === fileId) {
                    const newMeta = { ...(f.metadata || {}) };
                    if (targetAssetId) {
                        newMeta.assetId = targetAssetId;
                    } else {
                        delete newMeta.assetId;
                    }

                    // Update label to reflect the newly assigned unit
                    let updatedLabel = f.label || newMeta.label || 'Photo';
                    if (unitTag) {
                        const baseCategory = f.category || newMeta.category || 'Photo';
                        updatedLabel = `${baseCategory} (${unitTag})`;
                        newMeta.label = updatedLabel;
                        newMeta.notes = unitTag;
                    } else if (!targetAssetId) {
                        // Removed from unit -> General photo
                        const baseCategory = f.category || newMeta.category || 'General';
                        updatedLabel = baseCategory;
                        newMeta.label = updatedLabel;
                        delete newMeta.notes;
                    }

                    return {
                        ...f,
                        label: updatedLabel,
                        assetId: targetAssetId || undefined,
                        metadata: newMeta
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
            showToast.success(targetAssetId ? "Photo linked to unit!" : "Photo set to general job photo.");
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
            const targetLabel = label ? label.trim() : 'General';
            const currentFiles = (files && files.length > 0) ? files : (job.files || []);
            const updatedFiles = currentFiles.map(f => {
                if (f.id === fileId || f.dataUrl === fileId || f.url === fileId) {
                    return {
                        ...f,
                        label: targetLabel,
                        name: targetLabel,
                        metadata: {
                            ...(f.metadata || {}),
                            label: targetLabel,
                            notes: targetLabel
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

    const handleSaveSignOff = async (signOffFile: StoredFile, updatedJobFields?: Partial<Job>) => {
        const updatedFiles = updatedJobFields?.files || [...files, signOffFile];
        const sheetUrl = signOffFile.url || signOffFile.dataUrl;
        const signOffData = updatedJobFields?.signOff || {
            managerName: signOffFile.metadata?.managerName || null,
            technicianName: signOffFile.metadata?.technicianName || state.currentUser?.firstName || null,
            dateOfService: signOffFile.metadata?.dateOfService || new Date().toISOString().split('T')[0],
            sheetUrl: sheetUrl,
            timestamp: new Date().toISOString(),
            status: 'COMPLETED'
        };

        const updates: any = {
            files: updatedFiles,
            signOffSheetUrl: sheetUrl,
            signoffSheetUrl: sheetUrl,
            customWorkOrderFormUrl: sheetUrl,
            signOff: signOffData,
            signOffSignature: sheetUrl || 'SIGNED_ON_FILE',
            jobRecordSignedOff: true,
            jobRecordSignedOffAt: new Date().toISOString(),
            jobRecordSignedOffBy: state.currentUser?.name || state.currentUser?.firstName || 'Technician',
            updatedAt: new Date().toISOString(),
            ...(updatedJobFields || {})
        };

        setWorkflowState(prev => ({
            ...prev,
            jobRecordSignedOff: true,
            jobRecordSignedOffAt: updates.jobRecordSignedOffAt,
            jobRecordSignedOffBy: updates.jobRecordSignedOffBy,
            customerSignature: updates.customerSignature ?? prev.customerSignature,
            customerSignatureName: updates.customerSignatureName ?? prev.customerSignatureName,
            siteManagerSignature: updates.siteManagerSignature ?? prev.siteManagerSignature,
            siteManagerName: updates.siteManagerName ?? prev.siteManagerName,
            techSignature: updates.techSignature ?? prev.techSignature,
            techSignatureName: updates.techSignatureName ?? prev.techSignatureName,
            signature: updates.signature ?? prev.signature,
            signerName: updates.signerName ?? prev.signerName,
            signatureTimestamp: updates.signatureTimestamp ?? prev.signatureTimestamp
        }));

        setIsSaving(true);
        try {
            if (state.isDemoMode) {
                setFiles(updatedFiles);
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
                onUpdate({ ...job, ...updates } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
                setFiles(updatedFiles);
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
                onUpdate({ ...job, ...updates } as any);
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
        
        const isSignOff = fileToDelete.fileName === 'SignOff_Sheet.html' || 
                          fileToDelete.fileName?.toLowerCase().includes('signoff') ||
                          fileToDelete.fileName?.toLowerCase().includes('sign-off') ||
                          fileToDelete.fileName?.toLowerCase().includes('sign_off') ||
                          fileToDelete.metadata?.label === 'Sign-Off Sheet' ||
                          fileToDelete.metadata?.label?.toLowerCase().includes('sign-off') ||
                          fileToDelete.metadata?.label?.toLowerCase().includes('signoff') ||
                          fileToDelete.label?.toLowerCase().includes('sign-off') ||
                          fileToDelete.label?.toLowerCase().includes('signoff') ||
                          fileToDelete.category === 'signoff' ||
                          fileToDelete.metadata?.category === 'signoff' ||
                          fileToDelete.id?.startsWith('signoff-doc');

        const confirmMsg = isSignOff 
            ? t("Are you sure you want to remove this signed validation sheet? This will clear all recorded signatures and sign-off data for this job.")
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
            const targetUrl = fileToDelete.url || fileToDelete.dataUrl;
            const updatedFiles = files.filter(f => f.id !== fileId && (!targetUrl || (f.dataUrl !== targetUrl && f.url !== targetUrl)));
            
            const updates: any = {
                files: updatedFiles,
                updatedAt: new Date().toISOString()
            };

            if (isSignOff) {
                updates.signOff = null;
                updates.signOffSheetUrl = null;
                updates.signoffSheetUrl = null;
                updates.customWorkOrderFormUrl = null;
                updates.signOffSignature = null;
                updates.customerSignature = null;
                updates.customerSignatureName = null;
                updates.siteManagerSignature = null;
                updates.siteManagerName = null;
                updates.techSignature = null;
                updates.techSignatureName = null;
                updates.signature = null;
                updates.signerName = null;
                updates.signatureTimestamp = null;
                updates.signedAt = null;
                updates.managerName = null;

                setWorkflowState(prev => ({
                    ...prev,
                    customerSignature: null,
                    customerSignatureName: null,
                    siteManagerSignature: null,
                    siteManagerName: null,
                    techSignature: null,
                    techSignatureName: null,
                    signature: null,
                    signerName: null,
                    signatureTimestamp: null
                }));
            }

            if (state.isDemoMode) {
                setFiles(updatedFiles);
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
                onUpdate({ ...job, ...updates } as any);
            } else {
                await db.collection('jobs').doc(job.id).update(cleanUndefinedFields(updates));
                setFiles(updatedFiles);
                dispatch({ type: 'UPDATE_JOB', payload: { ...job, ...updates } });
                onUpdate({ ...job, ...updates } as any);
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
        const existingProp = state.proposals?.find(p => p.id === proposalId);
        const shouldUpdateJobId = !existingProp?.jobId || existingProp.jobId === job.id;
        const updatedLinkedJobIds = Array.from(new Set([...(existingProp?.linkedJobIds || []), job.id]));

        try {
            if (state.isDemoMode) {
                console.log("Demo Mode: Skipping proposal update.");
            } else {
                const propUpdates: any = {
                    linkedJobIds: updatedLinkedJobIds
                };
                if (shouldUpdateJobId) {
                    propUpdates.jobId = job.id;
                    propUpdates.poNumber = job.poNumber || null;
                }
                await db.collection('proposals').doc(proposalId).update(cleanUndefinedFields(propUpdates));
            }
        } catch (e) { console.error("Warning: Could not formally link proposal to jobId.", e); }

        dispatch({
            type: 'UPDATE_PROPOSAL',
            payload: {
                id: proposalId,
                linkedJobIds: updatedLinkedJobIds,
                ...(shouldUpdateJobId ? { jobId: job.id, poNumber: job.poNumber || null } : {})
            }
        });

        // Link the proposal to the job's linkedProposalIds (and proposalId only if this is the primary job)
        const updatedJobLinkedProps = Array.from(new Set([...(job.linkedProposalIds || []), proposalId]));
        const jobUpdates: any = { linkedProposalIds: updatedJobLinkedProps };
        if (shouldUpdateJobId) {
            jobUpdates.proposalId = proposalId;
        }
        await handleJobUpdate(jobUpdates);

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

    const handleBuildProposal = async (forceNew: boolean = false) => {
        await saveCurrentState();
        dispatch({ type: 'SET_ACTIVE_JOB_ID_FOR_WORKFLOW', payload: job.id });
        
        const isStaff = state.currentUser?.role === 'admin' || state.currentUser?.role === 'master_admin' || state.currentUser?.role === 'both' || state.currentUser?.role === 'supervisor';
        let basePath = isStaff ? '/admin' : '/briefing';
        if (window.location.hash.includes('/briefing')) {
            basePath = '/briefing';
        }
        
        const existingProposalId = job.proposalId || (job.linkedProposalIds && job.linkedProposalIds.length > 0 ? job.linkedProposalIds[0] : null);
        if (!forceNew && existingProposalId) {
            navigate(`${basePath}/proposal?jobId=${job.id}&source=workflow&proposalId=${existingProposalId}`);
        } else {
            navigate(`${basePath}/proposal?jobId=${job.id}&source=workflow${forceNew ? '&new=true' : ''}`);
        }
        onClose();
    };

    const handleInvoiceClick = async (forceNew: boolean = false) => {
        if (forceNew) {
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
                        amount: 0,
                        createdAt: new Date().toISOString(),
                        jobId: job.id
                    };
                    await handleJobUpdate({ invoice: clearedInvoice });
                    showToast.success(t(`New secondary invoice INV-${nextInvId} created!`));
                } catch (err: any) {
                    console.error("Failed to create secondary invoice:", err);
                }
            }
        }
        setIsInvoiceEditorOpen(true);
    };

    if (!isOpen) return null;

    return (
        <>
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col md:h-screen w-full overflow-hidden">
            {activeViewMode === 'dashboard' ? (
                <div className="flex-1 overflow-y-auto w-full custom-scrollbar p-3 sm:p-5">
                    <JobDashboardView
                        job={job}
                        assets={assets}
                        files={files}
                        unitStates={workflowState.unitStates || []}
                        currentUser={state.currentUser}
                        onClose={onClose}
                        onCheckIn={handleCheckIn}
                        onStartRoute={handleStartRoute}
                        onJobUpdate={handleJobUpdate}
                        onUpdateUnitState={(updatedState) => {
                            const currentStates = workflowState.unitStates || [];
                            const targetId = updatedState.assetId;
                            const idx = currentStates.findIndex(s => s.assetId === targetId);
                            const newStates = idx >= 0 
                                ? currentStates.map((s, i) => i === idx ? { ...s, ...updatedState } : s)
                                : [...currentStates, updatedState];
                            updateWorkflowState('unitStates', newStates);
                            handleJobUpdate({ unitStates: newStates });
                        }}
                        onAddEquipment={() => setIsAddAssetOpen(true)}
                        onOpenChecklists={() => setIsChecklistsModalOpen(true)}
                        onOpenProposals={() => handleBuildProposal()}
                        onOpenTools={() => setIsIndustryToolsOpen(true)}
                        onOpenBilling={() => setIsBillingModalOpen(true)}
                        onOpenAuditHistory={() => setIsAuditHistoryOpen(true)}
                        onOpenReopenModal={() => setIsReopenModalOpen(true)}
                        onOpenJobRecord={() => setIsJobRecordReviewOpen(true)}
                        onOpenSubBill={() => setIsSubBillOpen(true)}
                        onAddInvoiceLineItem={(item) => {
                            const currentInvoice = job.invoice || { id: `inv_${Date.now()}`, status: 'Unpaid', items: [], subtotal: 0, taxRate: 0, taxAmount: 0, totalAmount: 0, amount: 0 };
                            const newItems = [...(currentInvoice.items || []), { id: `li_${Date.now()}`, name: item.name, amount: item.amount, quantity: 1, total: item.amount, description: item.description }];
                            const newSubtotal = newItems.reduce((sum: number, i: any) => sum + (i.total || i.amount || 0), 0);
                            const effectiveTaxRate = typeof currentInvoice.taxRate === 'number' ? currentInvoice.taxRate : 0;
                            const newTax = typeof currentInvoice.taxAmount === 'number' && currentInvoice.taxAmount > 0 ? currentInvoice.taxAmount : newSubtotal * effectiveTaxRate;
                            const newTotal = newSubtotal + newTax;
                            handleJobUpdate({
                                visitType: 'Diagnostic & Repair',
                                invoice: {
                                    ...currentInvoice,
                                    items: newItems,
                                    subtotal: newSubtotal,
                                    taxAmount: newTax,
                                    totalAmount: newTotal,
                                    amount: newTotal
                                }
                            });
                        }}
                        takeNativePhoto={(label, targetAssetId) => handleNativeCameraTrigger(label, targetAssetId)}
                        pickGalleryPhotos={(label, targetAssetId) => handlePickGalleryImages(label, targetAssetId)}
                        onDeletePhoto={handleDeletePhoto}
                        onViewPhoto={setViewingPhoto}
                        onStopClock={handleStopClock}
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
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
                                    pickGalleryPhotos={() => handlePickGalleryImages('Before')}
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
                                    onCreateNewProposal={() => handleBuildProposal(true)} 
                                    onOpenProposalSelector={() => setIsProposalSelectorOpen(true)}
                                    linkedProposals={state.proposals?.filter(p => p.jobId === job.id || p.id === job.proposalId || p.linkedJobIds?.includes(job.id) || job.linkedProposalIds?.includes(p.id))}
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
                                    pickGalleryPhotos={() => handlePickGalleryImages('Before')}
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
                                <div className="p-4 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3">
                                    <div>
                                        <h4 className="font-bold text-sm text-purple-900 dark:text-purple-300">{t("Diagnostic Outcome & Next Steps")}</h4>
                                        <p className="text-xs text-purple-700 dark:text-purple-400">{t("Select the appropriate workflow path following diagnosis:")}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        <Button 
                                            type="button"
                                            onClick={async () => {
                                                await handleJobUpdate({ jobStatus: 'In Progress', visitType: 'Diagnostic & Repair' });
                                                scrollToSection('repair');
                                                showToast.success(t("Proceeding to Repair Workflow"));
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-11 flex items-center justify-center gap-1.5"
                                        >
                                            🔧 {t("1. Continue to Repair")}
                                        </Button>

                                        <Button 
                                            type="button"
                                            onClick={() => {
                                                scrollToSection('billing');
                                                showToast.info(t("Proceeding to Billing & Closeout"));
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-11 flex items-center justify-center gap-1.5"
                                        >
                                            💳 {t("2. Complete & Continue to Billing")}
                                        </Button>

                                        <Button 
                                            type="button"
                                            onClick={async () => {
                                                await handleJobUpdate({ jobStatus: 'Awaiting Customer Approval' });
                                                setIsProposalSelectorOpen(true);
                                                showToast.success(t("Status updated: Awaiting Customer Approval"));
                                            }}
                                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-11 flex items-center justify-center gap-1.5"
                                        >
                                            📄 {t("3. Send Proposal / Awaiting Approval")}
                                        </Button>

                                        <Button 
                                            type="button"
                                            onClick={async () => {
                                                await handleJobUpdate({ jobStatus: 'Needs Follow-up', repairPostponed: true });
                                                setIsScheduleFollowUpOpen(true);
                                                showToast.warn(t("Status updated: Return Visit Required"));
                                            }}
                                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-11 flex items-center justify-center gap-1.5"
                                        >
                                            📅 {t("4. Return Visit Required")}
                                        </Button>

                                        <Button 
                                            type="button"
                                            onClick={async () => {
                                                await handleJobUpdate({ repairPostponed: true, repairPostponedReason: 'No Repair Authorized' });
                                                scrollToSection('billing');
                                                showToast.info(t("No Repair Authorized: Proceeding to Billing"));
                                            }}
                                            className="bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs h-11 flex items-center justify-center gap-1.5 sm:col-span-2 lg:col-span-1"
                                        >
                                            🚫 {t("5. No Repair Authorized")}
                                        </Button>
                                    </div>
                                </div>
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
                                    pickGalleryPhotos={() => handlePickGalleryImages('After')}
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
                                    handleGoToPayments={() => handleInvoiceClick(false)}
                                    onCreateSecondaryInvoice={() => handleInvoiceClick(true)}
                                    existingInvoiceId={job.invoice?.id}
                                    onOpenInvoiceSelector={() => setIsInvoiceSelectorOpen(true)} 
                                    onOpenSignOff={() => setIsSignOffOpen(true)} 
                                    files={files}
                                    onPreviewFile={(file) => {
                                        const rawUrl = file.dataUrl || file.url || '';
                                        const isHtml = file.fileType === 'text/html' || file.fileName?.toLowerCase().endsWith('.html') || rawUrl.startsWith('data:text/html');
                                        let htmlContent: string | undefined = undefined;
                                        if (isHtml) {
                                            if (rawUrl.startsWith('data:text/html;base64,')) {
                                                try {
                                                    const base64Part = rawUrl.split('base64,')[1];
                                                    htmlContent = decodeURIComponent(escape(atob(base64Part)));
                                                } catch (err) {
                                                    console.error("Failed to decode base64 preview html:", err);
                                                }
                                            } else {
                                                htmlContent = rawUrl;
                                            }
                                        }
                                        setPreviewDoc({
                                            id: file.id,
                                            title: file.metadata?.label || file.label || "Sign-Off Sheet",
                                            htmlContent: htmlContent,
                                            ...file
                                        });
                                    }}
                                    onDeleteFile={handleDeleteWorkflowFile}
                                    onUploadFile={handlePhotoUpload}
                                    isSubcontractor={isSubcontractor || isSubcontractorJob}
                                    onOpenSubBill={() => setIsSubBillOpen(true)}
                                    onOpenJobRecordReview={() => setIsJobRecordReviewOpen(true)}
                                    isJobRecordSignedOff={workflowState.jobRecordSignedOff}
                                    jobRecordSignedOffBy={workflowState.jobRecordSignedOffBy}
                                    jobRecordSignedOffAt={workflowState.jobRecordSignedOffAt}
                                    membershipOffered={workflowState.membershipOffered}
                                    setMembershipOffered={(val) => setWorkflowState(prev => ({ ...prev, membershipOffered: val }))}
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
            )}

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
                        {assets.map(asset => {
                            const serialText = asset.serial || asset.serialNumber ? ` • S/N: ${asset.serial || asset.serialNumber}` : '';
                            const modelText = asset.model || asset.modelNumber ? ` • M/N: ${asset.model || asset.modelNumber}` : '';
                            const brandText = asset.brand ? ` (${asset.brand})` : '';
                            return (
                                <option key={asset.id} value={asset.id}>
                                    {asset.name || `${asset.brand || ''} ${t(asset.type || 'Unit')}`.trim()}{brandText}{modelText}{serialText}
                                </option>
                            );
                        })}
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
        <WaiverModal 
            isOpen={isWaiverOpen} 
            onClose={() => setIsWaiverOpen(false)} 
            onSign={(sig) => {
                updateWorkflowState('preWorkWaiverSignature', sig);
                updateWorkflowState('preWorkWaiverSignedAt', new Date().toISOString());
                updateWorkflowState('preWorkWaiverTitle', 'Waiver Agreement');
            }} 
            job={job} 
        />
        <SignOffModal isOpen={isSignOffOpen} onClose={() => setIsSignOffOpen(false)} job={job} onSave={handleSaveSignOff} />
        <ReopenJobModal isOpen={isReopenModalOpen} onClose={() => setIsReopenModalOpen(false)} job={job} onJobReopened={(updated) => { handleJobUpdate(updated); }} />
        <AuditHistoryModal isOpen={isAuditHistoryOpen} onClose={() => setIsAuditHistoryOpen(false)} job={job} />
        <SubcontractorBillModal isOpen={isSubBillOpen} onClose={() => setIsSubBillOpen(false)} job={job} onSave={handleSaveSignOff} />
        {isJobRecordReviewOpen && (
            <JobDetailModal
                isOpen={isJobRecordReviewOpen}
                onClose={() => setIsJobRecordReviewOpen(false)}
                job={job}
                isAdmin={true}
                isReviewMode={true}
                isJobRecordSignedOff={workflowState.jobRecordSignedOff}
                onSignOffJobRecord={handleJobRecordSignOff}
            />
        )}

        <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={handleScanResult} />
        <WebCameraModal isOpen={isWebCameraOpen} onClose={() => {
            setIsWebCameraOpen(false);
            setAssetCameraTarget(null);
            setCameraAssetId(null);
        }} onCapture={(dataUrl) => {
             const target = assetCameraTarget;
             const assignedAssetId = cameraAssetId;
             if (target) {
                 setIsWebCameraOpen(false);
                 setAssetCameraTarget(null);
                 setCameraAssetId(null);
             }
             fetch(dataUrl).then(r => r.blob()).then(async blob => {
                  const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
                  if (target) {
                      const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                      await handleAssetPhotoUpload(mockEvent, target);
                  } else {
                      processCapturedFile(file, cameraLabel, assignedAssetId || undefined);
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
            multiple
            title="Camera upload"
            ref={cameraInputRef} 
            onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                    handlePhotoUpload(e, cameraLabel);
                }
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
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto">
                <div className="min-h-screen p-3 sm:p-6 flex items-center justify-center">
                     <div className="relative w-full max-w-6xl bg-slate-50 dark:bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
                         <button aria-label="Close" title="Close" onClick={() => setIsIndustryToolsOpen(false)} className="absolute top-4 right-4 z-20 bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 p-2.5 rounded-full transition-all text-slate-700 dark:text-slate-200 cursor-pointer shadow-md">
                             <X size={20}/>
                         </button>
                         <div className="max-h-[88vh] overflow-y-auto custom-scrollbar">
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
                                    type="text" 
                                    inputMode="decimal"
                                    value={newAsset.gpsPin?.lat !== undefined && newAsset.gpsPin?.lat !== null ? String(newAsset.gpsPin.lat) : ''} 
                                    onChange={e => {
                                        const val = e.target.value.trim();
                                        if (val === '') {
                                            const currentLng = newAsset.gpsPin?.lng;
                                            setNewAsset({
                                                ...newAsset,
                                                gpsPin: (currentLng !== undefined && currentLng !== null) ? { lat: 0, lng: currentLng } : undefined
                                            });
                                        } else {
                                            const parsed = parseFloat(val);
                                            const currentLng = newAsset.gpsPin?.lng || 0;
                                            setNewAsset({
                                                ...newAsset,
                                                gpsPin: { lat: isNaN(parsed) ? 0 : parsed, lng: currentLng }
                                            });
                                        }
                                    }} 
                                    placeholder="29.4241"
                                />
                                <Input 
                                    label={t("GPS Longitude")} 
                                    type="text" 
                                    inputMode="decimal"
                                    value={newAsset.gpsPin?.lng !== undefined && newAsset.gpsPin?.lng !== null ? String(newAsset.gpsPin.lng) : ''} 
                                    onChange={e => {
                                        const val = e.target.value.trim();
                                        if (val === '') {
                                            const currentLat = newAsset.gpsPin?.lat;
                                            setNewAsset({
                                                ...newAsset,
                                                gpsPin: (currentLat !== undefined && currentLat !== null) ? { lat: currentLat, lng: 0 } : undefined
                                            });
                                        } else {
                                            const parsed = parseFloat(val);
                                            const currentLat = newAsset.gpsPin?.lat || 0;
                                            setNewAsset({
                                                ...newAsset,
                                                gpsPin: { lat: currentLat, lng: isNaN(parsed) ? 0 : parsed }
                                            });
                                        }
                                    }} 
                                    placeholder="-98.4936"
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                            <button 
                                type="button"
                                onClick={async () => {
                                    setGpsLoading(true);
                                    try {
                                        const loc = await getCurrentLocation();
                                        const lat = loc ? (typeof loc.lat === 'number' ? loc.lat : (loc as any).latitude) : undefined;
                                        const lng = loc ? (typeof loc.lng === 'number' ? loc.lng : (loc as any).longitude) : undefined;
                                        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                                            setNewAsset(prev => ({
                                                ...prev,
                                                gpsPin: { lat, lng }
                                            }));
                                            showToast.success(t(`GPS Coordinates Captured: ${lat.toFixed(6)}, ${lng.toFixed(6)}`));
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
                                className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 border border-indigo-200 hover:border-indigo-300 dark:border-indigo-900 dark:hover:border-indigo-800 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold h-9 transition-colors disabled:opacity-50"
                            >
                                <MapPin size={14} className={gpsLoading ? "animate-bounce" : ""} />
                                {gpsLoading ? t("Capturing GPS...") : t("Capture Device GPS")}
                            </button>

                            {jobSiteCoords && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewAsset(prev => ({
                                            ...prev,
                                            gpsPin: { lat: jobSiteCoords.lat, lng: jobSiteCoords.lng }
                                        }));
                                        showToast.success(t("Populated from Job Site address!"));
                                    }}
                                    className="flex items-center justify-center gap-1.5 py-2 px-3 border border-emerald-200 hover:border-emerald-300 dark:border-emerald-900 dark:hover:border-emerald-800 rounded-lg bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold h-9 transition-colors"
                                    title={t("Use geocoded coordinates for this job's address")}
                                >
                                    <Navigation size={13} />
                                    <span>{t("Use Job Site GPS")}</span>
                                </button>
                            )}

                            {newAsset.gpsPin && (newAsset.gpsPin.lat !== 0 || newAsset.gpsPin.lng !== 0) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewAsset(prev => ({ ...prev, gpsPin: undefined }));
                                        showToast.info(t("GPS coordinates cleared."));
                                    }}
                                    className="flex items-center justify-center gap-1 py-2 px-3 border border-rose-200 hover:border-rose-300 dark:border-rose-900 rounded-lg bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-semibold h-9 transition-colors"
                                >
                                    <X size={13} />
                                    <span>{t("Clear GPS")}</span>
                                </button>
                            )}
                        </div>

                        {newAsset.gpsPin && typeof newAsset.gpsPin.lat === 'number' && typeof newAsset.gpsPin.lng === 'number' && (newAsset.gpsPin.lat !== 0 || newAsset.gpsPin.lng !== 0) && (
                            <div className="flex items-center justify-between text-[11px] font-mono bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/50 mt-1">
                                <span className="text-indigo-900 dark:text-indigo-200 font-bold flex items-center gap-1">
                                    <MapPin size={12} className="text-indigo-600" />
                                    {newAsset.gpsPin.lat.toFixed(6)}, {newAsset.gpsPin.lng.toFixed(6)}
                                </span>
                                <a 
                                    href={`https://www.google.com/maps?q=${newAsset.gpsPin.lat},${newAsset.gpsPin.lng}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5 font-sans font-semibold"
                                >
                                    <span>{t("Preview Map")}</span>
                                    <ExternalLink size={11} />
                                </a>
                            </div>
                        )}
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
                                            <div className="absolute top-1 left-1 flex gap-1 z-10">
                                                <button type="button" onClick={async (e) => {
                                                    e.preventDefault(); e.stopPropagation();
                                                    try {
                                                        showToast.info("Scanning data plate with AI Vision...");
                                                        const ocrData = await scanDataPlatePhoto(newAsset.serialPhotoUrl!, {
                                                            brand: newAsset.brand,
                                                            model: newAsset.model,
                                                            serial: newAsset.serial,
                                                            year: newAsset.year,
                                                            tonnage: newAsset.tonnage ? String(newAsset.tonnage) : undefined,
                                                            refrigerantType: newAsset.refrigerantType,
                                                            electricityType: newAsset.electricityType,
                                                            seerRating: newAsset.seerRating
                                                        });
                                                        setNewAsset(prev => ({
                                                            ...prev,
                                                            brand: prev.brand && prev.brand.trim() !== '' ? prev.brand : (ocrData.brand || prev.brand),
                                                            model: prev.model && prev.model.trim() !== '' ? prev.model : (ocrData.model || prev.model),
                                                            serial: prev.serial && prev.serial.trim() !== '' ? prev.serial : (ocrData.serial || prev.serial),
                                                            year: prev.year && prev.year.trim() !== '' ? prev.year : (ocrData.year || prev.year),
                                                            tonnage: prev.tonnage ? prev.tonnage : (ocrData.tonnage ? Number(ocrData.tonnage) : prev.tonnage),
                                                            refrigerantType: prev.refrigerantType && prev.refrigerantType.trim() !== '' ? prev.refrigerantType : (ocrData.refrigerantType || prev.refrigerantType),
                                                            electricityType: prev.electricityType && prev.electricityType.trim() !== '' ? prev.electricityType : (ocrData.electricityType || prev.electricityType),
                                                            seerRating: prev.seerRating && prev.seerRating.trim() !== '' ? prev.seerRating : (ocrData.seerRating || prev.seerRating)
                                                        }));
                                                        showToast.success("AI Data Plate Vision scan complete!");
                                                    } catch (err) {
                                                        console.error("AI Data Plate OCR Failed:", err);
                                                        showToast.error("Data plate OCR scan failed.");
                                                    }
                                                }} className="p-1 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-md transition-transform hover:scale-110" title="Scan / Parse Data Plate with AI">
                                                    <Sparkles size={12} />
                                                </button>
                                            </div>
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
                                            <div className="absolute top-1 left-1 flex gap-1 z-10">
                                                <button type="button" onClick={async (e) => {
                                                    e.preventDefault(); e.stopPropagation();
                                                    try {
                                                        showToast.info("Scanning data plate with AI Vision...");
                                                        const ocrData = await scanDataPlatePhoto(newAsset.unitTagPhotoUrl!, {
                                                            brand: newAsset.brand,
                                                            model: newAsset.model,
                                                            serial: newAsset.serial,
                                                            year: newAsset.year,
                                                            tonnage: newAsset.tonnage ? String(newAsset.tonnage) : undefined,
                                                            refrigerantType: newAsset.refrigerantType,
                                                            electricityType: newAsset.electricityType,
                                                            seerRating: newAsset.seerRating
                                                        });
                                                        setNewAsset(prev => ({
                                                            ...prev,
                                                            brand: prev.brand && prev.brand.trim() !== '' ? prev.brand : (ocrData.brand || prev.brand),
                                                            model: prev.model && prev.model.trim() !== '' ? prev.model : (ocrData.model || prev.model),
                                                            serial: prev.serial && prev.serial.trim() !== '' ? prev.serial : (ocrData.serial || prev.serial),
                                                            year: prev.year && prev.year.trim() !== '' ? prev.year : (ocrData.year || prev.year),
                                                            tonnage: prev.tonnage ? prev.tonnage : (ocrData.tonnage ? Number(ocrData.tonnage) : prev.tonnage),
                                                            refrigerantType: prev.refrigerantType && prev.refrigerantType.trim() !== '' ? prev.refrigerantType : (ocrData.refrigerantType || prev.refrigerantType),
                                                            electricityType: prev.electricityType && prev.electricityType.trim() !== '' ? prev.electricityType : (ocrData.electricityType || prev.electricityType),
                                                            seerRating: prev.seerRating && prev.seerRating.trim() !== '' ? prev.seerRating : (ocrData.seerRating || prev.seerRating)
                                                        }));
                                                        showToast.success("AI Data Plate Vision scan complete!");
                                                    } catch (err) {
                                                        console.error("AI Data Plate OCR Failed:", err);
                                                        showToast.error("Data plate OCR scan failed.");
                                                    }
                                                }} className="p-1 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-md transition-transform hover:scale-110" title="Scan / Parse Data Plate with AI">
                                                    <Sparkles size={12} />
                                                </button>
                                            </div>
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

        {/* 4 Dedicated Standalone Modals for Master Job Actions */}
        <JobChecklistsModal
            isOpen={isChecklistsModalOpen}
            onClose={() => setIsChecklistsModalOpen(false)}
            job={job}
            workflowState={workflowState}
            onUpdateWorkflowState={updateWorkflowState}
        />

        <JobProposalsModal
            isOpen={isProposalsModalOpen}
            onClose={() => setIsProposalsModalOpen(false)}
            job={job}
            unitStates={workflowState.unitStates || []}
            onOpenProposalGenerator={(forceNew?: boolean) => handleBuildProposal(forceNew)}
            onAddProposalLineItem={(item) => {
                const currentInvoice = job.invoice || { id: `inv_${Date.now()}`, status: 'Unpaid', items: [], subtotal: 0, taxRate: 0, taxAmount: 0, totalAmount: 0, amount: 0 };
                const newItems = [...(currentInvoice.items || []), { id: `li_${Date.now()}`, name: item.name, amount: item.price, quantity: 1, total: item.price, description: item.name }];
                const newSubtotal = newItems.reduce((sum: number, i: any) => sum + (i.total || i.amount || 0), 0);
                const effectiveTaxRate = typeof currentInvoice.taxRate === 'number' ? currentInvoice.taxRate : 0;
                const newTax = typeof currentInvoice.taxAmount === 'number' && currentInvoice.taxAmount > 0 ? currentInvoice.taxAmount : newSubtotal * effectiveTaxRate;
                const newTotal = newSubtotal + newTax;
                handleJobUpdate({
                    visitType: 'Diagnostic & Repair',
                    invoice: {
                        ...currentInvoice,
                        items: newItems,
                        subtotal: newSubtotal,
                        taxAmount: newTax,
                        totalAmount: newTotal,
                        amount: newTotal
                    }
                });
            }}
        />

        <JobToolsModal
            isOpen={isToolsModalOpen}
            onClose={() => setIsToolsModalOpen(false)}
            job={job}
            workflowState={workflowState}
            onUpdateWorkflowState={updateWorkflowState}
        />

        <JobBillingModal
            isOpen={isBillingModalOpen}
            onClose={() => setIsBillingModalOpen(false)}
            job={job}
            workflowState={workflowState}
            unitStates={workflowState.unitStates || []}
            onUpdateWorkflowState={updateWorkflowState}
            onCompleteJob={() => handleLeaveSite()}
            onOpenJobRecordReview={() => setIsJobRecordReviewOpen(true)}
            onOpenInvoiceEditor={(forceNew) => handleInvoiceClick(forceNew)}
        />
        </div>
        </>
    );
};

export default JobWorkflowModal;
