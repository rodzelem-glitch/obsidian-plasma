import React, { useState, useEffect } from 'react';
import { Job, StoredFile } from '../../../types';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import { VoiceInput } from '../../../components/ui/VoiceInput';
import UnitWorkModal from './UnitWorkModal';
import SendSMSModal from '../../../components/modals/SendSMSModal';
import SendEmailModal from '../../../components/modals/SendEmailModal';
import DocumentPreview from '../../../components/ui/DocumentPreview';
import OneClickCheckInWidget from '../../../components/ui/OneClickCheckInWidget';
import CommercialWorkOrderProcessGuide from '../../../components/ui/CommercialWorkOrderProcessGuide';
import { useAppContext } from 'context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import showToast from 'lib/toast';
import { db, firebase } from '../../../lib/firebase';
import { cleanUndefinedFields, compressFile } from '../../../lib/utils';
import { uploadFileToStorage } from '../../../lib/storageService';
import { offlineSyncManager } from '../../../lib/offlineSyncManager';
import { resolveJobProposalNumber } from '../../../lib/numbering';
import { getCurrentLocation } from '../../../lib/geolocation';
import {
  Cpu,
  Plus,
  ClipboardCheck,
  FileText,
  Wrench,
  CreditCard,
  Phone,
  Navigation,
  Clock,
  Camera,
  CheckCircle,
  AlertTriangle,
  Zap,
  Shield,
  History,
  Lock,
  Unlock,
  ChevronRight,
  Mail,
  MessageSquare,
  ExternalLink,
  Play,
  Trash2,
  RotateCcw,
  CheckCircle2,
  QrCode,
  Package,
  Bot,
  Sparkles,
  X,
  Heart,
  Building2,
  MapPin,
  ClipboardList,
  Pencil,
  Compass,
  Image as ImageIcon
} from 'lucide-react';

interface JobDashboardViewProps {
  job: Job;
  assets: any[];
  files: StoredFile[];
  unitStates: any[];
  currentUser?: any;
  onUpdateUnitState: (updatedState: any) => void;
  onAddEquipment: () => void;
  onOpenChecklists: () => void;
  onOpenProposals: () => void;
  onOpenTools: () => void;
  onOpenBilling: () => void;
  onOpenAuditHistory: () => void;
  onOpenReopenModal: () => void;
  onOpenJobRecord?: () => void;
  onOpenSubBill?: () => void;
  onAddInvoiceLineItem?: (item: { name: string; amount: number; description: string }) => void;
  takeNativePhoto?: (label: string, assetId?: string) => void;
  pickGalleryPhotos?: (label: string, assetId?: string) => void;
  onDeletePhoto?: (file: StoredFile) => void;
  onViewPhoto?: (file: StoredFile) => void;
  onStopClock?: () => void;
  onCheckIn?: () => void;
  onStartRoute?: () => void;
  onJobUpdate?: (updates: Partial<Job>) => Promise<void>;
  onUpdateAsset?: (updatedAsset: any) => Promise<void>;
  onClose?: () => void;
}

const JobDashboardView: React.FC<JobDashboardViewProps> = ({
  job,
  assets,
  files,
  unitStates,
  currentUser,
  onUpdateUnitState,
  onAddEquipment,
  onOpenChecklists,
  onOpenProposals,
  onOpenTools,
  onClose,
  onOpenBilling,
  onOpenAuditHistory,
  onOpenReopenModal,
  onOpenJobRecord,
  onOpenSubBill,
  onAddInvoiceLineItem,
  takeNativePhoto,
  pickGalleryPhotos,
  onDeletePhoto,
  onViewPhoto,
  onStopClock,
  onCheckIn,
  onStartRoute,
  onJobUpdate,
  onUpdateAsset,
}) => {
  const { t } = useLanguage();
  const { state, dispatch } = useAppContext();
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [activeLocationFilter, setActiveLocationFilter] = useState<string>('All');

  // Edit Asset Modal State
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [editAssetName, setEditAssetName] = useState('');
  const [editAssetBrand, setEditAssetBrand] = useState('');
  const [editAssetModel, setEditAssetModel] = useState('');
  const [editAssetSerial, setEditAssetSerial] = useState('');
  const [editAssetLocation, setEditAssetLocation] = useState('');
  const [editAssetSystemGroup, setEditAssetSystemGroup] = useState('');
  const [editAssetLinkedId, setEditAssetLinkedId] = useState('');
  const [editAssetRefrigerant, setEditAssetRefrigerant] = useState('');
  const [editAssetGpsLat, setEditAssetGpsLat] = useState('');
  const [editAssetGpsLng, setEditAssetGpsLng] = useState('');
  const [isGpsCapturing, setIsGpsCapturing] = useState(false);
  const [isSavingAsset, setIsSavingAsset] = useState(false);

  const handleCaptureAssetGps = async () => {
    setIsGpsCapturing(true);
    try {
      const loc = await getCurrentLocation();
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        setEditAssetGpsLat(loc.lat.toFixed(6));
        setEditAssetGpsLng(loc.lng.toFixed(6));
        showToast.success(t(`GPS Pin captured: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`));
      } else {
        showToast.warn(t("Unable to acquire location fix. Please check device location permissions."));
      }
    } catch (err: any) {
      console.error("GPS capture error:", err);
      showToast.error(t("GPS acquisition error: ") + (err.message || 'Check location permissions'));
    } finally {
      setIsGpsCapturing(false);
    }
  };

  const handleUseJobSiteGps = () => {
    const coords = (job.address as any)?.coordinates || (job as any)?.jobSiteCoords || (job as any)?.coordinates;
    const lat = coords?.lat || coords?.latitude || (typeof (job as any)?.lat === 'number' ? (job as any).lat : undefined);
    const lng = coords?.lng || coords?.longitude || (typeof (job as any)?.lng === 'number' ? (job as any).lng : undefined);
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      setEditAssetGpsLat(lat.toFixed(6));
      setEditAssetGpsLng(lng.toFixed(6));
      showToast.success(t(`Applied Job Site Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`));
    } else {
      showToast.warn(t("No valid job site GPS coordinates found on work order."));
    }
  };

  const handleOpenEditAssetModal = (assetToEdit: any) => {
    setEditingAsset(assetToEdit);
    setEditAssetName(assetToEdit.name || assetToEdit.unitName || '');
    setEditAssetBrand(assetToEdit.brand || assetToEdit.manufacturer || '');
    setEditAssetModel(assetToEdit.model || assetToEdit.modelNumber || '');
    setEditAssetSerial(assetToEdit.serial || assetToEdit.serialNumber || '');
    
    const locStr = typeof assetToEdit.location === 'string' 
      ? assetToEdit.location 
      : (assetToEdit.location?.name || assetToEdit.location?.building || assetToEdit.building || assetToEdit.subLocationName || '');
    setEditAssetLocation(locStr);
    
    setEditAssetSystemGroup(assetToEdit.systemGroupName || assetToEdit.systemGroup || assetToEdit.systemName || assetToEdit.circuitId || '');
    setEditAssetLinkedId(assetToEdit.linkedAssetId || assetToEdit.parentAssetId || assetToEdit.linkedUnitId || '');
    setEditAssetRefrigerant(assetToEdit.refrigerantType || 'R-410A (Puron)');

    const latVal = (typeof assetToEdit.gpsPin?.lat === 'number') ? String(assetToEdit.gpsPin.lat) : (typeof assetToEdit.gpsLat === 'number') ? String(assetToEdit.gpsLat) : '';
    const lngVal = (typeof assetToEdit.gpsPin?.lng === 'number') ? String(assetToEdit.gpsPin.lng) : (typeof assetToEdit.gpsLng === 'number') ? String(assetToEdit.gpsLng) : '';
    setEditAssetGpsLat(latVal);
    setEditAssetGpsLng(lngVal);
  };

  const handleSaveAssetDetails = async () => {
    if (!editingAsset) return;
    if (!editAssetName.trim()) {
      showToast.warn(t("Please enter an asset unit name."));
      return;
    }
    setIsSavingAsset(true);
    try {
      const parsedLat = editAssetGpsLat.trim() !== '' ? parseFloat(editAssetGpsLat) : undefined;
      const parsedLng = editAssetGpsLng.trim() !== '' ? parseFloat(editAssetGpsLng) : undefined;
      const validGpsPin = (typeof parsedLat === 'number' && !isNaN(parsedLat) && typeof parsedLng === 'number' && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0))
        ? { lat: parsedLat, lng: parsedLng }
        : undefined;

      const updatedPayload = {
        ...editingAsset,
        name: editAssetName.trim(),
        unitName: editAssetName.trim(),
        brand: editAssetBrand.trim(),
        manufacturer: editAssetBrand.trim(),
        model: editAssetModel.trim(),
        modelNumber: editAssetModel.trim(),
        serial: editAssetSerial.trim(),
        serialNumber: editAssetSerial.trim(),
        location: editAssetLocation.trim(),
        subLocationName: editAssetLocation.trim(),
        building: editAssetLocation.trim(),
        systemGroupName: editAssetSystemGroup.trim(),
        systemName: editAssetSystemGroup.trim(),
        linkedAssetId: editAssetLinkedId.trim(),
        refrigerantType: editAssetRefrigerant.trim(),
        gpsPin: validGpsPin,
        ...(validGpsPin ? { gpsLat: validGpsPin.lat, gpsLng: validGpsPin.lng } : { gpsLat: undefined, gpsLng: undefined }),
        updatedAt: new Date().toISOString(),
      };

      // 1. Save to Firestore equipment / assets collection
      try {
        await db.collection('equipment').doc(editingAsset.id).set(cleanUndefinedFields(updatedPayload), { merge: true });
      } catch (e) {
        try {
          await db.collection('assets').doc(editingAsset.id).set(cleanUndefinedFields(updatedPayload), { merge: true });
        } catch (err) {
          console.warn("Firestore equipment save fallback:", err);
        }
      }

      // 2. Also update customer document equipment list if customer exists
      if (customer && customer.id) {
        const updatedEquipmentList = (customer.equipment || []).map((eq: any) => 
          eq.id === editingAsset.id ? { ...eq, ...updatedPayload } : eq
        );
        try {
          await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ equipment: updatedEquipmentList }));
          dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, equipment: updatedEquipmentList } });
        } catch (e) {
          console.warn("Customer equipment update warning:", e);
        }
      }

      if (onUpdateAsset) {
        await onUpdateAsset(updatedPayload);
      }

      showToast.success(t(`Asset "${updatedPayload.name}" details updated successfully!`));
    } catch (err: any) {
      console.error("Failed to update asset details:", err);
      showToast.error(t("Failed to save asset details: ") + err.message);
    } finally {
      setIsSavingAsset(false);
      setEditingAsset(null);
    }
  };

  // Customer & Service Locations Lookup
  const customer = React.useMemo(() => {
    return state.customers?.find(c => c.id === job.customerId || (job.customerName && (c.name === job.customerName || (c as any).companyName === job.customerName)));
  }, [state.customers, job.customerId, job.customerName]);

  const is23rdGroup = React.useMemo(() => {
    const custName = customer?.name || (typeof job.customerName === 'string' ? job.customerName : '') || '';
    return custName.toLowerCase().includes('23rd');
  }, [customer?.name, job.customerName]);

  const hasCustomerRules = React.useMemo(() => {
    if (is23rdGroup) return true;
    if (!customer?.submissionRules) return false;
    const rules = customer.submissionRules;
    return !!(
      rules.requirePoNumber ||
      rules.requireSignedWorkOrder ||
      rules.requireBeforeAfterPhotos ||
      rules.requireEquipmentSerial ||
      rules.thirdPartyPortal?.required ||
      rules.checkInProcedure?.required ||
      rules.requireNteApprovalCall ||
      rules.defaultNteLimit ||
      rules.accountManagerContact?.name ||
      rules.customSubmissionNotes ||
      rules.invoiceSubmissionEmail ||
      rules.requireProposalWithin24Hours ||
      rules.noPaperworkForStoreAssociate ||
      rules.doNotDiscussPricingWithStoreAssociate
    );
  }, [is23rdGroup, customer?.submissionRules]);

  const serviceLocations = React.useMemo(() => {
    return customer?.serviceLocations || [];
  }, [customer]);

  // Sub-Locations Only Filter (Filters to show true child sub-locations / buildings for the site location)
  const siteSubLocationsOnly = React.useMemo(() => {
    if (!serviceLocations.length) return [];
    const currentSiteId = job.locationId || job.propertyId;

    return serviceLocations.filter((loc: any) => {
      // Exclude the main parent site location itself
      if (currentSiteId && loc.id === currentSiteId) {
        return false;
      }
      // Include explicit child sub-locations of this site location
      if (loc.parentId && currentSiteId && loc.parentId === currentSiteId) {
        return true;
      }
      // Include any sub-location entry with parentId or subLocationName
      if (loc.parentId && loc.parentId !== 'main') {
        return true;
      }
      if (loc.subLocationName && loc.subLocationName.trim()) {
        return true;
      }
      if (loc.building && loc.name && loc.building !== loc.name) {
        return true;
      }
      return false;
    });
  }, [serviceLocations, job.locationId, job.propertyId]);

  // Active Sub-Location State
  const [activeSubLocationId, setActiveSubLocationId] = useState<string>(
    (job as any).activeSubLocationId || job.subLocationId || ''
  );
  const [activeSubLocationName, setActiveSubLocationName] = useState<string>(
    job.subLocationName || (job as any).subLocation || ((serviceLocations.find((l: any) => l.id === job.locationId) as any)?.subLocationName) || ''
  );

  // Add Sub-Location Modal State
  const [isAddSubLocationOpen, setIsAddSubLocationOpen] = useState(false);
  const [newSubLocName, setNewSubLocName] = useState('');
  const [newSubLocBuilding, setNewSubLocBuilding] = useState('');
  const [newSubLocNotes, setNewSubLocNotes] = useState('');
  const [isSavingSubLoc, setIsSavingSubLoc] = useState(false);

  const handleSelectSubLocation = async (locId: string, locName: string) => {
    // 1. Auto-save prior sub-location work state & notes before switching
    try {
      if (onJobUpdate) {
        await onJobUpdate({
          notes: {
            ...(job.notes || {}),
            completion: completionNotes,
            thankYouNote: thankYouNote
          },
          membershipOffered,
          techRecommendations,
          activeSubLocationId: locId,
          subLocationName: locName,
          unitStates,
        });
      }
    } catch (e) {
      console.warn("Auto-save prior sub-location state failed:", e);
    }

    setActiveSubLocationId(locId);
    setActiveSubLocationName(locName);

    if (locName) {
      setActiveLocationFilter(locName);
    } else {
      setActiveLocationFilter('All');
    }

    showToast.success(t(`Saved previous building work & switched active area to: ${locName || 'Main Location'}`));
  };

  const handleAddSubLocationSubmit = async () => {
    if (!newSubLocName.trim()) {
      showToast.warn(t("Please enter a sub-location or building name."));
      return;
    }
    setIsSavingSubLoc(true);
    try {
      const newLocId = `loc_${Date.now()}`;
      const parentLocId = job.locationId || serviceLocations[0]?.id || 'main';
      const locPayload = {
        id: newLocId,
        parentId: parentLocId,
        name: newSubLocName.trim(),
        propertyName: newSubLocName.trim(),
        subLocationName: newSubLocName.trim(),
        building: newSubLocBuilding.trim() || newSubLocName.trim(),
        address: typeof job.address === 'string' ? job.address : (job.address as any)?.street || '',
        notes: newSubLocNotes.trim(),
        createdAt: new Date().toISOString(),
      };

      // Save to Firestore serviceLocations collection
      await db.collection('serviceLocations').doc(newLocId).set(cleanUndefinedFields(locPayload));

      if (customer && customer.id) {
        const updatedLocations = [...(customer.serviceLocations || []), locPayload];
        await db.collection('customers').doc(customer.id).update(cleanUndefinedFields({ serviceLocations: updatedLocations }));
        dispatch({ type: 'UPDATE_CUSTOMER', payload: { ...customer, serviceLocations: updatedLocations } });
      }

      // Update active sub-location on Job
      if (onJobUpdate) {
        await onJobUpdate({
          activeSubLocationId: newLocId,
          subLocationName: locPayload.name,
        });
      }

      setActiveSubLocationId(newLocId);
      setActiveSubLocationName(locPayload.name);
      setActiveLocationFilter(locPayload.name);
      showToast.success(t(`Sub-location "${locPayload.name}" added and set as active!`));
      setIsAddSubLocationOpen(false);
      setNewSubLocName('');
      setNewSubLocBuilding('');
      setNewSubLocNotes('');
    } catch (err: any) {
      console.error("Failed to add sub-location:", err);
      showToast.error(t("Failed to add sub-location: ") + err.message);
    } finally {
      setIsSavingSubLoc(false);
    }
  };

  // Document Viewer Modal States
  const [viewingProposal, setViewingProposal] = useState<any | null>(null);
  const [viewingInvoiceJob, setViewingInvoiceJob] = useState<any | null>(null);
  const [previewOtherDoc, setPreviewOtherDoc] = useState<any | null>(null);

  const isSubcontractor = currentUser?.role === 'Subcontractor' || (currentUser as any)?.isSubcontractor || false;

  // Live Timer for Time on Site Tracking
  const isCheckedIn = job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime());
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  useEffect(() => {
    let interval: number;
    if (isCheckedIn && job.checkInTime) {
      interval = window.setInterval(() => {
        const diff = Math.max(0, new Date().getTime() - new Date(job.checkInTime!).getTime());
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setElapsedTime(`${h}:${m}:${s}`);
      }, 1000);
    } else {
      setElapsedTime('00:00:00');
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, job.checkInTime]);

  // Manual Time Adjustments State
  const [isManualTimeOpen, setIsManualTimeOpen] = useState(false);
  const [localTimeEntries, setLocalTimeEntries] = useState<any[]>(job.timeEntries || []);
  const [isSavingManualVisits, setIsSavingManualVisits] = useState(false);

  // Job In Progress Parts & Postponement State
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [partName, setPartName] = useState('');
  const [partPrice, setPartPrice] = useState('0');
  const [partQty, setPartQty] = useState('1');
  const [partLocation, setPartLocation] = useState('Truck Stock');
  const [repairPostponed, setRepairPostponed] = useState<boolean>(Boolean(job.repairPostponed));
  const [repairPostponedReason, setRepairPostponedReason] = useState<string>(job.repairPostponedReason || '');

  // Comprehensive Legacy Note Resolution Helpers
  const getLegacyGeneralNotes = (j: any): string => {
    if (!j) return '';
    if (typeof j.arrivalNotes === 'string' && j.arrivalNotes.trim()) return j.arrivalNotes.trim();
    if (j.notes && typeof j.notes === 'object') {
      if (typeof j.notes.arrival === 'string' && j.notes.arrival.trim()) return j.notes.arrival.trim();
      if (typeof j.notes.arrivalNotes === 'string' && j.notes.arrivalNotes.trim()) return j.notes.arrivalNotes.trim();
      if (typeof j.notes.general === 'string' && j.notes.general.trim()) return j.notes.general.trim();
      if (typeof j.notes.generalNotes === 'string' && j.notes.generalNotes.trim()) return j.notes.generalNotes.trim();
      if (typeof j.notes.notes === 'string' && j.notes.notes.trim()) return j.notes.notes.trim();
    }
    if (typeof j.generalNotes === 'string' && j.generalNotes.trim()) return j.generalNotes.trim();
    if (typeof j.initialNotes === 'string' && j.initialNotes.trim()) return j.initialNotes.trim();
    if (typeof j.arrival === 'string' && j.arrival.trim()) return j.arrival.trim();
    return '';
  };

  const getLegacyCompletionNotes = (j: any): string => {
    if (!j) return '';
    if (typeof j.notes === 'string' && j.notes.trim()) return j.notes.trim();
    if (j.notes && typeof j.notes === 'object') {
      if (typeof j.notes.completion === 'string' && j.notes.completion.trim()) return j.notes.completion.trim();
      if (typeof j.notes.jobNotes === 'string' && j.notes.jobNotes.trim()) return j.notes.jobNotes.trim();
      if (typeof j.notes.description === 'string' && j.notes.description.trim()) return j.notes.description.trim();
      if (typeof j.notes.workPerformed === 'string' && j.notes.workPerformed.trim()) return j.notes.workPerformed.trim();
      if (typeof j.notes.summary === 'string' && j.notes.summary.trim()) return j.notes.summary.trim();
    }
    if (typeof j.completionNotes === 'string' && j.completionNotes.trim()) return j.completionNotes.trim();
    if (typeof j.jobNotes === 'string' && j.jobNotes.trim()) return j.jobNotes.trim();
    if (typeof j.description === 'string' && j.description.trim()) return j.description.trim();
    if (typeof j.workPerformed === 'string' && j.workPerformed.trim()) return j.workPerformed.trim();
    if (typeof j.workOrderNotes === 'string' && j.workOrderNotes.trim()) return j.workOrderNotes.trim();
    if (typeof j.scopeOfWork === 'string' && j.scopeOfWork.trim()) return j.scopeOfWork.trim();
    if (typeof j.summary === 'string' && j.summary.trim()) return j.summary.trim();
    return '';
  };

  const getLegacyRecommendations = (j: any): string => {
    if (!j) return '';
    if (typeof j.techRecommendations === 'string' && j.techRecommendations.trim()) return j.techRecommendations.trim();
    if (typeof j.recommendations === 'string' && j.recommendations.trim()) return j.recommendations.trim();
    if (j.notes && typeof j.notes === 'object' && typeof j.notes.recommendations === 'string' && j.notes.recommendations.trim()) {
      return j.notes.recommendations.trim();
    }
    return '';
  };

  const getLegacyThankYouNote = (j: any): string => {
    if (!j) return '';
    if (typeof j.thankYouNote === 'string' && j.thankYouNote.trim()) return j.thankYouNote.trim();
    if (j.notes && typeof j.notes === 'object' && typeof j.notes.thankYouNote === 'string' && j.notes.thankYouNote.trim()) {
      return j.notes.thankYouNote.trim();
    }
    return '';
  };

  // Job Notes (General/Arrival, Completion, Membership, Recommendations, Thank You Note State)
  const [generalNotes, setGeneralNotes] = useState<string>(() => getLegacyGeneralNotes(job));
  const [completionNotes, setCompletionNotes] = useState<string>(() => getLegacyCompletionNotes(job));
  const [membershipOffered, setMembershipOffered] = useState<boolean>(Boolean(job.membershipOffered));
  const [techRecommendations, setTechRecommendations] = useState<string>(() => getLegacyRecommendations(job));
  const [thankYouNote, setThankYouNote] = useState<string>(() => getLegacyThankYouNote(job));
  const [activeNotesTab, setActiveNotesTab] = useState<'general' | 'completion' | 'recommendations' | 'thankyou'>(
    getLegacyGeneralNotes(job) ? 'general' : 'completion'
  );
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Job Photos & Media Gallery State
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'before' | 'after' | 'units' | 'docs'>('all');
  const [uploadCategory, setUploadCategory] = useState<string>('Before');
  const [uploadAssetId, setUploadAssetId] = useState<string>('general');

  // Photo Edit & Tagging Modal State
  const [editingPhoto, setEditingPhoto] = useState<any | null>(null);
  const [editLabelCategory, setEditLabelCategory] = useState<string>('Before');
  const [editAssetId, setEditAssetId] = useState<string>('general');
  const [editCustomNotes, setEditCustomNotes] = useState<string>('');

  const allJobPhotos = React.useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    const addFile = (f: any, fallbackLabel?: string) => {
      if (!f) return;
      const url = typeof f === 'string' ? f : (f.dataUrl || f.url);
      if (!url || seen.has(url)) return;
      seen.add(url);

      const label = (typeof f === 'object' && (f.label || f.metadata?.label)) || fallbackLabel || 'General';

      if (typeof f === 'string') {
        list.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          fileName: fallbackLabel || 'Job Photo',
          url: url,
          dataUrl: url,
          fileType: 'image/jpeg',
          createdAt: new Date().toISOString(),
          metadata: { label },
          label,
          categoryLabel: label
        });
      } else {
        list.push({
          ...f,
          url: f.url || f.dataUrl,
          dataUrl: f.dataUrl || f.url,
          label: f.label || f.metadata?.label || fallbackLabel || 'General',
          categoryLabel: label
        });
      }
    };

    // 1. Files from props files and job.files merged safely
    const allSources = [...(files || []), ...(job.files || [])];
    const seenFiles = new Set<string>();
    allSources.forEach(f => {
      if (!f) return;
      const url = f.dataUrl || f.url;
      const key = f.id || url;
      if (key && seenFiles.has(key)) return;
      if (key) seenFiles.add(key);

      const isImg = f.fileType?.startsWith('image/') || 
                    (f as any).contentType?.startsWith('image/') || 
                    f.dataUrl?.startsWith('data:image/') || 
                    (url && url.match(/\.(jpeg|jpg|png|webp|gif|heic)($|\?)/i)) || 
                    f.fileName?.match(/\.(jpeg|jpg|png|webp|gif|heic)$/i) || 
                    (f.metadata?.category && f.metadata.category !== 'document');
      if (isImg) {
        addFile(f);
      }
    });

    // 2. Photos from unitStates
    (unitStates || []).forEach((u: any) => {
      addFile(u.beforePhotoUrl, 'Before');
      addFile(u.afterPhotoUrl, 'After');
      addFile(u.photoUrl, 'Unit Photo');
      addFile(u.dataPlatePhotoUrl, 'Data Plate');
      if (Array.isArray(u.photos)) {
        u.photos.forEach((p: any) => addFile(p, 'Unit Photo'));
      }
    });

    return list;
  }, [files, job.files, unitStates]);

  const filteredGalleryPhotos = React.useMemo(() => {
    if (galleryFilter === 'all') return allJobPhotos;
    if (galleryFilter === 'before') {
      return allJobPhotos.filter(f => {
        const lbl = (f.label || f.categoryLabel || f.metadata?.label || '').toLowerCase();
        return lbl.includes('before') || lbl.includes('pre-work');
      });
    }
    if (galleryFilter === 'after') {
      return allJobPhotos.filter(f => {
        const lbl = (f.label || f.categoryLabel || f.metadata?.label || '').toLowerCase();
        return lbl.includes('after') || lbl.includes('completed');
      });
    }
    if (galleryFilter === 'units') {
      return allJobPhotos.filter(f => {
        const lbl = (f.label || f.categoryLabel || f.metadata?.label || '').toLowerCase();
        return lbl.includes('unit') || lbl.includes('plate') || lbl.includes('data') || f.metadata?.assetId || f.assetId;
      });
    }
    if (galleryFilter === 'docs') {
      return (job.files || files || []).filter((f: any) => {
        const type = (f.fileType || f.contentType || '').toLowerCase();
        const name = (f.fileName || f.name || '').toLowerCase();
        return type.includes('pdf') || type.includes('document') || name.endsWith('.pdf') || name.endsWith('.html');
      });
    }
    return allJobPhotos;
  }, [allJobPhotos, galleryFilter, job.files, files]);

  const handleDashboardPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded || uploaded.length === 0) return;

    const targetAssetId = uploadAssetId !== 'general' ? uploadAssetId : undefined;
    const orgId = job.organizationId || state.currentOrganization?.id || state.currentUser?.organizationId || currentUser?.organizationId || 'default';
    const filesArray = Array.from(uploaded);

    showToast.info(t(`Uploading ${filesArray.length} photo(s)...`));

    try {
      const newStoredFiles: StoredFile[] = [];
      let queuedOfflineCount = 0;

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : `photo_${Date.now()}.jpg`;
        const path = `organizations/${orgId}/jobs/${job.id}/photos/${Date.now()}_${i}_${safeName}`;
        const fileId = `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        
        let fileUrl = '';
        let isOfflineQueued = false;

        if (state.isDemoMode) {
          fileUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        } else {
          // Check if offline or if storage upload encounters network error
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            isOfflineQueued = true;
          } else {
            try {
              fileUrl = await uploadFileToStorage(path, file);
            } catch (upErr: any) {
              console.warn("Direct storage upload failed, falling back to local offline staging:", upErr);
              isOfflineQueued = true;
            }
          }

          if (isOfflineQueued) {
            // Convert file to Base64 data URL with client-side compression for offline queueing & mobile storage safety
            try {
              fileUrl = await compressFile(file, 0.7);
            } catch (compErr) {
              fileUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
              });
            }
            queuedOfflineCount++;

            // Register with offline sync queue for automatic upload on reconnection
            await offlineSyncManager.registerPendingUpload({
              id: fileId,
              jobId: job.id,
              parentId: job.id,
              parentCollection: 'jobs',
              orgId: orgId,
              storagePath: path,
              dataUrl: fileUrl,
              fileName: file.name || safeName,
              fileType: file.type || 'image/jpeg',
              timestamp: Date.now(),
              updateField: 'files'
            });
          }
        }

        const newFile: StoredFile = {
          id: fileId,
          organizationId: orgId,
          parentId: job.id,
          parentType: 'job',
          fileName: file.name || safeName,
          fileType: file.type || 'image/jpeg',
          dataUrl: fileUrl,
          url: fileUrl,
          createdAt: new Date().toISOString(),
          uploadedBy: currentUser?.displayName || currentUser?.name || 'Technician',
          label: uploadCategory,
          ...(targetAssetId ? { assetId: targetAssetId } : {}),
          metadata: {
            label: uploadCategory,
            category: uploadCategory.toLowerCase(),
            ...(targetAssetId ? { assetId: targetAssetId } : {}),
            uploadedFrom: 'JobDashboardView',
            pendingUpload: isOfflineQueued
          }
        };
        newStoredFiles.push(newFile);
      }

      const cleanedNewFiles = cleanUndefinedFields(newStoredFiles);
      const allExisting = [...(files || []), ...(job.files || [])];
      const seenExisting = new Set<string>();
      const currentJobFiles = allExisting.filter((f: any) => {
        const key = f.id || f.dataUrl || f.url;
        if (!key || seenExisting.has(key)) return false;
        seenExisting.add(key);
        return true;
      });
      const updatedFiles = [...currentJobFiles, ...cleanedNewFiles];

      if (onJobUpdate) {
        await onJobUpdate({ files: updatedFiles });
      } else if (!state.isDemoMode && cleanedNewFiles.length > 0) {
        await db.collection('jobs').doc(job.id).update({
          files: firebase.firestore.FieldValue.arrayUnion(...cleanedNewFiles),
          updatedAt: new Date().toISOString()
        });
      }

      if (queuedOfflineCount > 0) {
        showToast.info(t(`${queuedOfflineCount} photo(s) saved offline. Will sync automatically when connection returns!`));
      } else {
        showToast.success(t(`${newStoredFiles.length} photo(s) uploaded & saved as ${uploadCategory}!`));
      }
    } catch (err: any) {
      console.error("Dashboard Photo Upload Error:", err);
      showToast.error(t("Failed to save photos. Please try again."));
    } finally {
      e.target.value = '';
    }
  };

  const handleOpenEditPhotoModal = (photo: any) => {
    setEditingPhoto(photo);
    const existingLabel = photo.label || photo.categoryLabel || photo.metadata?.label || 'General';
    let baseCategory = 'General';
    if (existingLabel.toLowerCase().includes('before')) baseCategory = 'Before';
    else if (existingLabel.toLowerCase().includes('after')) baseCategory = 'After';
    else if (existingLabel.toLowerCase().includes('plate') || existingLabel.toLowerCase().includes('data')) baseCategory = 'Data Plate';
    else if (existingLabel.toLowerCase().includes('defect') || existingLabel.toLowerCase().includes('damage')) baseCategory = 'Defect / Damage';
    else if (existingLabel.toLowerCase().includes('electric')) baseCategory = 'Electrical';

    setEditLabelCategory(baseCategory);
    setEditAssetId(photo.metadata?.assetId || photo.assetId || 'general');
    
    let initialNotes = photo.metadata?.notes || '';
    if (initialNotes.startsWith('RTU') || initialNotes === 'RTU 6' || initialNotes === photo.assetId) {
      initialNotes = '';
    }
    setEditCustomNotes(initialNotes);
  };

  const handleSavePhotoLabelEdit = async () => {
    if (!editingPhoto) return;

    const targetId = editingPhoto.id || editingPhoto.url || editingPhoto.dataUrl;
    const finalAssetId = editAssetId && editAssetId !== 'general' ? editAssetId.trim() : undefined;
    const selectedAssetObj = (assets || []).find((a: any) => a.id === finalAssetId);
    const unitName = selectedAssetObj?.name || selectedAssetObj?.title || '';

    let notesStr = editCustomNotes.trim();
    // If user didn't enter custom notes but selected a unit, default notes to the unit name
    if (!notesStr && unitName) {
      notesStr = unitName;
    }

    const finalLabel = notesStr ? `${editLabelCategory} (${notesStr})` : editLabelCategory;

    const sourceFiles = (files && files.length > 0 ? files : (job.files || []));
    const updatedFiles = sourceFiles.map((f: any) => {
      const fId = f.id || f.url || f.dataUrl;
      const isTarget = fId === targetId || 
                       (f.id && editingPhoto.id && f.id === editingPhoto.id) ||
                       (f.dataUrl && (f.dataUrl === editingPhoto.dataUrl || f.dataUrl === editingPhoto.url)) || 
                       (f.url && (f.url === editingPhoto.url || f.url === editingPhoto.dataUrl));
      if (isTarget) {
        const newMeta = { ...(f.metadata || {}) };
        if (finalAssetId) {
          newMeta.assetId = finalAssetId;
        } else {
          delete newMeta.assetId;
        }
        newMeta.label = finalLabel;
        newMeta.category = editLabelCategory.toLowerCase();
        if (notesStr) {
          newMeta.notes = notesStr;
        } else {
          delete newMeta.notes;
        }

        return {
          ...f,
          label: finalLabel,
          name: notesStr || f.name || f.fileName,
          fileName: notesStr ? (notesStr.includes('.') ? notesStr : `${notesStr}.jpg`) : f.fileName,
          assetId: finalAssetId || undefined,
          metadata: newMeta
        };
      }
      return f;
    });

    try {
      if (onJobUpdate) {
        await onJobUpdate({ files: updatedFiles });
        showToast.success(t("Photo label and unit assignment updated!"));
      }
    } catch (err: any) {
      console.error("Failed to update photo label:", err);
      showToast.error(t("Failed to save photo label: ") + (err?.message || "Unknown error"));
    } finally {
      setEditingPhoto(null);
    }
  };

  useEffect(() => {
    setGeneralNotes(getLegacyGeneralNotes(job));
    setCompletionNotes(getLegacyCompletionNotes(job));
    setTechRecommendations(getLegacyRecommendations(job));
    setThankYouNote(getLegacyThankYouNote(job));
    setMembershipOffered(Boolean(job.membershipOffered));
    setRepairPostponed(Boolean(job.repairPostponed));
    setRepairPostponedReason(job.repairPostponedReason || '');
    setLocalTimeEntries(job.timeEntries || []);
  }, [job]);

  const handleSaveJobNotes = async () => {
    setIsSavingNotes(true);
    try {
      if (onJobUpdate) {
        await onJobUpdate({
          notes: {
            ...(job.notes || {}),
            general: generalNotes,
            generalNotes: generalNotes,
            arrival: generalNotes,
            arrivalNotes: generalNotes,
            completion: completionNotes,
            recommendations: techRecommendations,
            thankYouNote: thankYouNote
          },
          generalNotes,
          arrivalNotes: generalNotes,
          completionNotes,
          jobNotes: completionNotes,
          description: completionNotes,
          membershipOffered,
          techRecommendations,
          recommendations: techRecommendations,
          thankYouNote
        });
      }
      showToast.success(t("Job notes & documentation saved!"));
    } catch (err: any) {
      showToast.error("Failed to save notes: " + err.message);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleTogglePostponed = async (checked: boolean, reason?: string) => {
    setRepairPostponed(checked);
    const targetReason = reason !== undefined ? reason : repairPostponedReason;
    if (onJobUpdate) {
      await onJobUpdate({
        repairPostponed: checked,
        repairPostponedReason: targetReason
      });
    }
    showToast.success(checked ? t("Job marked as Repair Postponed / Return Visit Required") : t("Postponement status cleared"));
  };

  const handleSavePartToJob = async () => {
    if (!partName.trim()) {
      showToast.warn(t("Please enter a part name."));
      return;
    }
    try {
      const newPart = {
        id: `part_${Date.now()}`,
        name: partName.trim(),
        quantity: Number(partQty) || 1,
        location: partLocation || 'Truck Stock',
        price: Number(partPrice) || 0,
        addedAt: new Date().toISOString()
      };
      const updatedParts = [...(job.consumedParts || []), newPart];
      if (onJobUpdate) {
        await onJobUpdate({ consumedParts: updatedParts });
      }
      if (onAddInvoiceLineItem && Number(partPrice) > 0) {
        onAddInvoiceLineItem({
          name: `${newPart.name} (Qty: ${newPart.quantity})`,
          amount: newPart.price * newPart.quantity,
          description: `Installed part - ${newPart.location}`
        });
      }
      showToast.success(t(`Added ${newPart.name} to job records!`));
    } catch (err: any) {
      console.error("Failed to add part to job:", err);
      showToast.error(t("Failed to add part: ") + (err?.message || "Unknown error"));
    } finally {
      setShowAddPartModal(false);
      setPartName('');
      setPartPrice('0');
      setPartQty('1');
    }
  };

  useEffect(() => {
    setLocalTimeEntries(job.timeEntries || []);
  }, [job.timeEntries]);

  // Format helper to local ISO-ish string without timezone suffix for <input type="datetime-local">
  const formatDateTimeForInput = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
  };

  const handleSaveManualVisitsList = async (entries: any[]) => {
    if (!onJobUpdate) return;
    setIsSavingManualVisits(true);
    try {
      const validEntries = entries.map(entry => {
        let duration = entry.timeOnSiteMinutes;
        if (entry.checkInTime && entry.checkOutTime) {
          const durationMs = new Date(entry.checkOutTime).getTime() - new Date(entry.checkInTime).getTime();
          duration = Math.max(0, Math.round(durationMs / 60000));
        }
        return {
          ...entry,
          timeOnSiteMinutes: duration
        };
      });

      const totalMins = validEntries.reduce((acc: number, entry: any) => acc + (entry.timeOnSiteMinutes || 0), 0);
      const lastEntry = validEntries[validEntries.length - 1];

      await onJobUpdate({
        timeEntries: validEntries,
        timeOnSiteMinutes: totalMins,
        checkInTime: lastEntry ? lastEntry.checkInTime : job.checkInTime,
        checkOutTime: lastEntry ? lastEntry.checkOutTime : job.checkOutTime,
      });
      showToast.success(t("Manual time entries saved!"));
    } catch (err: any) {
      console.error("Failed to save manual time entries:", err);
      showToast.error(t("Failed to save manual time entries: ") + err.message);
    } finally {
      setIsSavingManualVisits(false);
    }
  };

  const handleAddVisitEntry = () => {
    const now = new Date().toISOString();
    const next = [...localTimeEntries, { checkInTime: now, checkOutTime: null, timeOnSiteMinutes: null }];
    setLocalTimeEntries(next);
    handleSaveManualVisitsList(next);
  };

  const handleUpdateVisitEntry = (idx: number, field: string, value: string) => {
    setLocalTimeEntries(prev => {
      const copy = [...prev];
      const entry = { ...copy[idx] };
      if (value) {
        const d = new Date(value);
        entry[field] = !isNaN(d.getTime()) ? d.toISOString() : null;
      } else {
        entry[field] = null;
      }
      if (entry.checkInTime && entry.checkOutTime) {
        const durationMs = new Date(entry.checkOutTime).getTime() - new Date(entry.checkInTime).getTime();
        entry.timeOnSiteMinutes = Math.max(0, Math.round(durationMs / 60000));
      } else {
        entry.timeOnSiteMinutes = null;
      }
      copy[idx] = entry;
      return copy;
    });
  };

  const handleDeleteVisitEntry = (idx: number) => {
    const next = localTimeEntries.filter((_, i) => i !== idx);
    setLocalTimeEntries(next);
    handleSaveManualVisitsList(next);
  };

  const handleSaveManualVisits = async () => {
    await handleSaveManualVisitsList(localTimeEntries);
  };

  const hasManualLogsActive = (job.timeEntries && job.timeEntries.length > 0) || job.timeOnSiteMinutes !== undefined || job.checkOutTime;

  // Send SMS Modal state
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  // Send Email Modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState(`Update regarding Work Order #${job.poNumber || job.id.slice(-6).toUpperCase()}`);
  const [emailBody, setEmailBody] = useState(`Hello ${job.customerName || 'Customer'},\n\nThis is an update regarding your service visit at ${typeof job.address === 'string' ? job.address : 'your service address'}.\n\nBest regards,\nYour Service Team`);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSendEmailSubmit = async () => {
    const recipientEmail = job.customerEmail;
    if (!recipientEmail) {
      showToast.warn(t("No customer email address on file for this job."));
      return;
    }

    setIsSendingEmail(true);
    try {
      const { sendEmail } = await import('../../../lib/mailService');
      await sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        text: emailBody,
        organization: state.currentOrganization,
        organizationId: job.organizationId || state.currentOrganization?.id || 'system',
        bypassOptOut: true,
      });
      showToast.success(t("Email sent successfully to customer!"));
      setIsEmailModalOpen(false);
    } catch (err) {
      console.error("Failed to send email:", err);
      showToast.error(t("Failed to send email. Please try again."));
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Helper to generate canonical system key for grouping & color coding (with symmetrical reverse lookup)
  const getSystemKey = (a: any) => {
    if (!a) return null;

    // 1. Direct explicit system group / name / circuit / system string fields
    const directGroup = a.systemGroupName || a.systemGroup || a.system_group_name || a.system_group || a.systemName || a.system_name || a.system || a.systemId || a.system_id || a.circuitId || a.circuit_id || a.circuitName || a.circuit_name || a.circuit;
    if (directGroup && String(directGroup).trim()) {
      return `group_${String(directGroup).trim().toLowerCase()}`;
    }

    // 2. Check explicit linked IDs on this asset
    const myId = String(a.id || '');
    const myLinkedId = String(a.linkedAssetId || a.parentAssetId || a.linkedUnitId || a.pairedAssetId || a.pairId || a.connectedUnitId || a.connectedAssetId || a.linked_asset_id || a.linked_unit_id || a.parent_unit_id || '');

    if (myLinkedId && myLinkedId !== 'undefined' && myLinkedId !== 'null' && myId) {
      return `pair_${[myId, myLinkedId].sort().join('_')}`;
    }

    // 3. Reverse lookup: check if any OTHER asset in the assets list links to MY id!
    if (myId && assets && assets.length > 0) {
      const otherPair = assets.find((other: any) => {
        if (!other || other.id === a.id) return false;
        const otherLinkedId = String(other.linkedAssetId || other.parentAssetId || other.linkedUnitId || other.pairedAssetId || other.pairId || other.connectedUnitId || other.connectedAssetId || other.linked_asset_id || other.linked_unit_id || other.parent_unit_id || '');
        return otherLinkedId === myId;
      });
      if (otherPair && otherPair.id) {
        return `pair_${[myId, String(otherPair.id)].sort().join('_')}`;
      }
    }

    return null;
  };

  // Golden Ratio HSL System Color Generator for Linked Assets
  // Uses golden angle spacing (137.508°) to generate infinite distinct, vibrant colors
  const getSystemColor = (index: number) => {
    const hue = Math.round((index * 137.508) % 360);
    return {
      hue,
      borderLeftStyle: `6px solid hsl(${hue}, 85%, 45%)`,
      badgeStyle: {
        backgroundColor: `hsl(${hue}, 90%, 94%)`,
        color: `hsl(${hue}, 95%, 22%)`,
        borderColor: `hsl(${hue}, 70%, 75%)`,
      },
    };
  };

  // Build map of unique system names to system group indices
  const systemGroupsMap = new Map<string, number>();
  let systemGroupCounter = 0;
  assets.forEach((a) => {
    const key = getSystemKey(a);
    if (key && !systemGroupsMap.has(key)) {
      systemGroupsMap.set(key, systemGroupCounter++);
    }
  });

  // Collect sub-locations for filter tab strip
  const locationsSet = new Set<string>(['All']);
  assets.forEach((a: any) => {
    const locName = typeof a.location === 'string' ? a.location : (a.location?.name || a.location?.building || a.building || '');
    if (locName) locationsSet.add(locName);
  });
  const locationFilters = Array.from(locationsSet);

  const filteredAssets = React.useMemo(() => {
    if (activeLocationFilter === 'All' && !activeSubLocationId && !activeSubLocationName) {
      return assets;
    }

    const filterTarget = (activeLocationFilter && activeLocationFilter !== 'All') 
      ? activeLocationFilter.toLowerCase() 
      : (activeSubLocationName ? activeSubLocationName.toLowerCase() : '');

    if (!filterTarget && !activeSubLocationId) return assets;

    return assets.filter((a: any) => {
      // 1. Direct ID match (propertyId, locationId, subLocationId)
      if (activeSubLocationId && (a.propertyId === activeSubLocationId || a.locationId === activeSubLocationId || a.subLocationId === activeSubLocationId)) {
        return true;
      }

      // 2. Name / Building string match
      if (filterTarget) {
        const locStr = typeof a.location === 'string' 
          ? a.location.toLowerCase() 
          : (a.location?.name || a.location?.building || a.building || a.locationName || '').toLowerCase();
        const bldgStr = (a.building || '').toLowerCase();

        if (locStr === filterTarget || bldgStr === filterTarget || locStr.includes(filterTarget) || bldgStr.includes(filterTarget)) {
          return true;
        }
      }

      return false;
    });
  }, [assets, activeLocationFilter, activeSubLocationId, activeSubLocationName]);

  // Aggregate total proposal line items across all units
  const totalUnitProposalItems = unitStates.reduce((acc, us) => acc + (us.unitLineItems?.length || 0), 0);

  const getUnitStateForAsset = (assetId: string) => {
    return (
      unitStates.find((us) => us.assetId === assetId) || {
        assetId,
        health: 'Good',
        diagnosis: '',
        repair: '',
        recommendations: '',
        unitLineItems: [],
        notServicedToday: false,
      }
    );
  };

  const handleToggleNotServiced = async (assetId: string, notServicedToday: boolean) => {
    const existingIndex = (job.unitStates || []).findIndex((u: any) => u.assetId === assetId);
    let updatedUnitStates = [...(job.unitStates || [])];

    if (existingIndex >= 0) {
      updatedUnitStates[existingIndex] = {
        ...updatedUnitStates[existingIndex],
        notServicedToday,
      };
    } else {
      updatedUnitStates.push({
        assetId,
        notServicedToday,
        health: 'Good',
      });
    }

    if (onJobUpdate) {
      await onJobUpdate({ unitStates: updatedUnitStates });
    }

    showToast.info(
      notServicedToday 
        ? t("Unit marked as not serviced today (excluded from visit report).") 
        : t("Unit included in today's visit report.")
    );
  };

  const getHealthBadge = (healthBefore?: string, healthAfter?: string, currentHealth?: string) => {
    const renderTag = (h?: string, label?: string) => {
      switch (h) {
        case 'Critical':
          return <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">{label ? `${label}: ` : ''}Critical</span>;
        case 'Poor':
          return <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">{label ? `${label}: ` : ''}Poor</span>;
        case 'Fair':
          return <span className="bg-yellow-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">{label ? `${label}: ` : ''}Fair</span>;
        default:
          return <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">{label ? `${label}: ` : ''}Good</span>;
      }
    };

    if (healthBefore && healthAfter && healthBefore !== healthAfter) {
      return (
        <div className="flex items-center gap-1">
          {renderTag(healthBefore, 'Diag')}
          <span className="text-[10px] text-slate-400 font-bold">➔</span>
          {renderTag(healthAfter, 'Post-Repair')}
        </div>
      );
    }

    return renderTag(healthAfter || healthBefore || currentHealth || 'Good');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 pb-24 text-slate-800 dark:text-slate-200">
      
      {/* 1. Master Job Header Card */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 text-center relative">
        
        {/* Top Title Strip: Site Location (Bigger & Bolded), Customer Name (Smaller, Unbolded, Hidden for Subcontractors), WO Badges */}
        <div className="flex flex-col items-center justify-center text-center gap-3 sm:gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5 text-center flex flex-col items-center max-w-full px-8 sm:px-12">
            {/* Prominent Site Location (Name + Address) - Bigger & Bolded */}
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white flex flex-wrap items-center justify-center gap-2 text-center break-words">
              <Navigation className="text-primary-600 shrink-0" size={22} />
              <span>
                {(() => {
                  const locName = typeof (job as any).locationName === 'string' ? (job as any).locationName :
                                  typeof (job as any).siteName === 'string' ? (job as any).siteName :
                                  typeof (job as any).propertyName === 'string' ? (job as any).propertyName : '';
                  const addrStr = typeof job.address === 'string' ? job.address :
                                  (job.address && typeof job.address === 'object') ? `${(job.address as any).street || (job.address as any).address || ''} ${(job.address as any).city || ''}`.trim() : 'Service Location Unspecified';
                  return `${locName ? locName + ' — ' : ''}${addrStr || 'Service Location Unspecified'}`;
                })()}
              </span>
            </h1>

            {/* Sub-strip: Customer Name (Smaller, Unbolded, Hidden for Subcontractors) & WO Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {!isSubcontractor && job.customerName && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  {t("Customer:")} {typeof job.customerName === 'string' ? job.customerName : (typeof job.customerName === 'object' ? `${(job.customerName as any).firstName || ''} ${(job.customerName as any).lastName || ''}`.trim() : String(job.customerName))}
                </span>
              )}
              <span className="text-xs font-black uppercase tracking-wider bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300 px-2.5 py-0.5 rounded-full">
                WO #{job.poNumber || job.id.slice(-6).toUpperCase()}
              </span>
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                job.jobStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                job.jobStatus === 'Awaiting Customer Approval' ? 'bg-purple-100 text-purple-800' :
                job.jobStatus === 'Needs Follow-up' ? 'bg-amber-100 text-amber-900' :
                'bg-blue-100 text-blue-800'
              }`}>
                {job.jobStatus}
              </span>
            </div>
          </div>

          {/* Quick Header Actions: Call, SMS, Email, Navigate, Audit */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {job.customerPhone && (
              <a
                href={`tel:${job.customerPhone}`}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 rounded-xl text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs font-bold transition-colors"
                title={t("Call Customer")}
              >
                <Phone size={16} className="text-primary-600" />
                <span>{t("Call")}</span>
              </a>
            )}

            {!isSubcontractor && (
              <>
                {job.customerPhone && (
                  <button
                    type="button"
                    onClick={() => setIsSmsModalOpen(true)}
                    className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-colors border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                    title={t("Send SMS via TekTrakker")}
                  >
                    <MessageSquare size={16} className="text-emerald-600" />
                    <span>{t("SMS")}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(true)}
                  className="p-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 hover:bg-purple-100 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-colors border border-purple-200 dark:border-purple-800"
                  title={t("Send Email")}
                >
                  <Mail size={16} className="text-purple-600" />
                  <span>{t("Email")}</span>
                </button>
              </>
            )}

            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(typeof job.address === 'string' ? job.address : '')}`}
              target="_blank"
              rel="noreferrer"
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 rounded-xl text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs font-bold transition-colors"
              title={t("Navigate with GPS")}
            >
              <Navigation size={16} className="text-primary-600" />
              <span>{t("Navigate")}</span>
            </a>

            <button
              onClick={onOpenAuditHistory}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs font-bold"
              title={t("View Permanent Audit Log")}
            >
              <History size={16} />
              <span>{t("Audit")}</span>
            </button>

            {job.jobStatus === 'Completed' && (
              <button
                onClick={onOpenReopenModal}
                className="p-2.5 bg-amber-100 text-amber-900 rounded-xl flex items-center gap-1.5 text-xs font-bold"
                title={t("Reopen Completed Job")}
              >
                <Unlock size={16} />
                <span>{t("Reopen")}</span>
              </button>
            )}

            {job.checkInTime && (!job.checkOutTime || new Date(job.checkInTime).getTime() > new Date(job.checkOutTime).getTime()) && onStopClock && (
              <Button
                variant="secondary"
                onClick={onStopClock}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold h-10 px-3 flex items-center gap-1.5"
              >
                <Clock size={14} className="animate-pulse" />
                {t("Stop Clock")}
              </Button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                title={t("Close")}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0 cursor-pointer absolute top-4 right-4"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Linked Documents Strip (Proposals, Invoices, Job Records, Work Orders Only) */}
        {(() => {
          const linkedDocs: Array<{ id: string; title: string; colorClass: string; onClick?: () => void }> = [];

          // 1. Internal Work Order (Subcontractor WO / NTE) - Only populate if internal WO exists or sub assigned
          const subBillFile = (job.files || files || []).find((f: any) =>
            f.fileName === 'Subcontractor_Bill.html' ||
            f.metadata?.label === 'Subcontractor Bill' ||
            f.id?.startsWith('subcontractorbill-doc') ||
            f.fileName?.startsWith('Subcontractor_Bill_')
          );
          const hasSubAssignment = !!(job.assignedSubcontractorId || job.subcontractorId || job.subcontractorName || job.subcontractor || job.subcontractorCompany || job.subcontractorEmail || job.assignedPartnerId || (job as any).subcontractorWorkOrder);
          const hasInternalWo = !!subBillFile || hasSubAssignment;

          if (hasInternalWo) {
            linkedDocs.push({
              id: 'internal_wo',
              title: `📑 ${t("Internal Work Order")}`,
              colorClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100',
              onClick: () => {
                if (subBillFile) {
                  setPreviewOtherDoc({ ...subBillFile, type: 'Other', title: t('Internal Work Order') });
                } else {
                  setPreviewOtherDoc({
                    id: `subwo-${job.id}`,
                    type: 'Other',
                    title: t('Internal Work Order'),
                    job,
                    workOrderNo: job.poNumber || job.id.slice(-6).toUpperCase()
                  });
                }
              },
            });
          }

          if (!isSubcontractor) {
            // 2. External Customer Work Order - Internal Staff Only
            linkedDocs.push({
              id: 'external_wo',
              title: `📑 ${t("Customer WO #")}${job.poNumber || job.id.slice(-6).toUpperCase()}`,
              colorClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100',
              onClick: () => {
                dispatch({
                  type: 'SET_VIEWING_WORK_ORDER',
                  payload: {
                    workOrderNumber: job.poNumber || job.id,
                    customerId: job.customerId
                  }
                });
              },
            });

            // 3. Signed Job Record - Internal Staff Only
            if (job.jobRecordSignedOff) {
              linkedDocs.push({
                id: 'job_record',
                title: `📋 ${t("Signed Job Record")}`,
                colorClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100',
                onClick: () => {
                  const file = (job.files || files || []).find((f: any) =>
                    f.fileName === 'SignOff_Sheet.html' ||
                    f.fileName?.toLowerCase().includes('signoff') ||
                    f.fileName?.toLowerCase().includes('sign-off') ||
                    f.fileName?.toLowerCase().includes('sign_off') ||
                    f.metadata?.label === 'Sign-Off Sheet' ||
                    f.metadata?.label?.toLowerCase().includes('sign-off') ||
                    f.metadata?.label?.toLowerCase().includes('signoff') ||
                    f.label?.toLowerCase().includes('sign-off') ||
                    f.label?.toLowerCase().includes('signoff') ||
                    f.category === 'signoff' ||
                    f.metadata?.category === 'signoff' ||
                    f.id?.startsWith('signoff-doc')
                  );
                  if (file) {
                    setPreviewOtherDoc({ ...file, type: 'Other', title: t('Sign-Off Sheet') });
                  } else if (onOpenJobRecord) {
                    onOpenJobRecord();
                  }
                },
              });
            }

            // 4. Proposals - Internal Staff Only (Support Multiple Proposals)
            const linkedProps = (state.proposals || []).filter((p: any) =>
              p.id === job.proposalId ||
              p.id === job.projectId ||
              p.jobId === job.id ||
              job.linkedProposalIds?.includes(p.id) ||
              p.linkedJobIds?.includes(job.id)
            );

            if (linkedProps.length > 0) {
              linkedProps.forEach((propItem: any, index: number) => {
                linkedDocs.push({
                  id: `proposal_${propItem.id || index}`,
                  title: `📄 ${t("Proposal #")}${propItem.proposalNumber || propItem.id || (index + 1)}`,
                  colorClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100',
                  onClick: () => setViewingProposal(propItem),
                });
              });
            } else if (totalUnitProposalItems > 0 || (job.linkedProposalIds && job.linkedProposalIds.length > 0) || job.proposal) {
              const fallbackProp = job.proposal || {
                id: resolveJobProposalNumber(job),
                proposalNumber: resolveJobProposalNumber(job),
                jobId: job.id,
                customerName: job.customerName,
                address: job.address,
                items: [],
                total: job.totalAmount || 0
              };
              linkedDocs.push({
                id: 'proposal_draft',
                title: `📄 ${t("Field Proposal Draft")}`,
                colorClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100',
                onClick: () => setViewingProposal(fallbackProp),
              });
            }

            // 5. Invoices - Internal Staff Only (Support Multiple Invoices)
            const poNum = job.poNumber || job.id;
            const relatedJobsWithInvoices = (state.jobs || []).filter((j: any) =>
              j.invoice && (
                j.id === job.id ||
                j.poNumber === poNum ||
                (job.poNumber && j.poNumber === job.poNumber)
              )
            );

            if (relatedJobsWithInvoices.length > 0) {
              const seenInvoiceIds = new Set<string>();
              relatedJobsWithInvoices.forEach((jobWithInv: any, idx: number) => {
                const invId = jobWithInv.invoice?.id || `INV-${idx}`;
                if (!seenInvoiceIds.has(invId)) {
                  seenInvoiceIds.add(invId);
                  linkedDocs.push({
                    id: `customer_invoice_${invId}`,
                    title: `💳 ${t("Customer Invoice #")}${invId}`,
                    colorClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100',
                    onClick: () => setViewingInvoiceJob(jobWithInv),
                  });
                }
              });
            } else if (job.invoice) {
              linkedDocs.push({
                id: 'customer_invoice',
                title: `💳 ${t("Customer Invoice #")}${job.invoice.id || 'INV'}`,
                colorClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100',
                onClick: () => setViewingInvoiceJob(job),
              });
            }

            // 6. Associations Link - Open WorkOrderAssociationsModal to link more documents
            linkedDocs.push({
              id: 'manage_associations',
              title: `🔗 ${t("+ Link / Manage Associations")}`,
              colorClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 font-extrabold',
              onClick: () => {
                dispatch({
                  type: 'SET_VIEWING_WORK_ORDER',
                  payload: {
                    workOrderNumber: job.poNumber || job.id,
                    customerId: job.customerId
                  }
                });
              },
            });
          }

          return (
            <div className="space-y-1.5 pt-1 text-center">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">
                {t("Linked Documents")} ({linkedDocs.length})
              </label>
              {linkedDocs.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {linkedDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={doc.onClick}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all border shadow-2xs ${doc.colorClass}`}
                    >
                      <span className="truncate max-w-[220px]">{doc.title}</span>
                      <ExternalLink size={11} className="opacity-60 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic text-center">{t("No linked document records available.")}</p>
              )}
            </div>
          );
        })()}
      </div>

      {/* 1.5 Time on Site Tracking & Control Hub (Full Width Banner Card) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {!isCheckedIn ? (
            <>
              <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock size={22} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                    {t("Time on Site Tracking")}
                    <span className="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-extrabold uppercase">
                      {t("Off Site")}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {job.transitStartTime 
                      ? t("En route to customer since {time}.", { time: new Date(job.transitStartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })
                      : t("Start transit or check in to begin timing.")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto shrink-0">
                {!job.transitStartTime ? (
                  <button
                    type="button"
                    onClick={onStartRoute}
                    className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <Navigation size={13} fill="currentColor" />
                    {t("In Route")}
                  </button>
                ) : (
                  <span className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-xs font-extrabold rounded-xl uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                    <Navigation size={13} className="mr-1.5 animate-pulse" />
                    {t("En Route")}
                  </span>
                )}

                <button
                  type="button"
                  onClick={onCheckIn}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <Play size={13} fill="currentColor" />
                  {t("Arrive on Site")}
                </button>

                <button
                  type="button"
                  onClick={onStopClock}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <CheckCircle2 size={13} className="text-slate-500" />
                  {t("Leave Site")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 relative">
                  <Clock size={22} />
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-ping" />
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
                    {t("Time on Site Tracking")}
                    <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-extrabold uppercase">
                      {t("Checked In")}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {t("Arrived at {time}. Timing is active.", { time: new Date(job.checkInTime!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto shrink-0">
                <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 min-w-[130px]">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t("Elapsed")}</span>
                  <span className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">{elapsedTime}</span>
                </div>

                <button
                  type="button"
                  onClick={onStopClock}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  {t("Leave Site")}
                </button>

                <button
                  type="button"
                  onClick={onCheckIn}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 text-xs font-bold uppercase rounded-xl transition-colors cursor-pointer text-center"
                >
                  {t("Reset Clock")}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Manual Override Button & Status Badge */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center w-full">
          <button
            type="button"
            onClick={() => setIsManualTimeOpen(!isManualTimeOpen)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-bold flex items-center gap-1.5 focus:outline-none cursor-pointer"
          >
            <Clock size={13} />
            {isManualTimeOpen ? t("Hide Manual Adjustments") : t("Adjust or Log Job Time Manually")}
          </button>

          {hasManualLogsActive && (
            <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-extrabold uppercase border border-indigo-200 dark:border-indigo-800">
              {t("Manual Logs Active")}
            </span>
          )}
        </div>

        {/* Manual Time Entry Fields */}
        {isManualTimeOpen && (
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 w-full animate-fade-in">
            <div className="flex justify-between items-center">
              <div>
                <h5 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {t("Log On-Site Time Manually")}
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("Adjust, delete or add visits for multi-day operations.")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVisitEntry}
                className="px-3 py-1.5 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase rounded-xl transition-colors flex items-center gap-1 border border-primary-200 dark:border-primary-800 cursor-pointer"
              >
                <Plus size={13} />
                {t("Add Visit")}
              </button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {localTimeEntries.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-3">{t("No visits logged yet. Click Add Visit to log time.")}</p>
              ) : (
                localTimeEntries.map((entry: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {t("Visit #{num}", { num: String(idx + 1) })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteVisitEntry(idx)}
                        className="text-rose-600 hover:text-rose-700 p-1 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        {t("Delete")}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Check-In Time")}</label>
                        <Input
                          type="datetime-local"
                          value={formatDateTimeForInput(entry.checkInTime)}
                          onChange={(e) => handleUpdateVisitEntry(idx, 'checkInTime', e.target.value)}
                          onBlur={() => handleSaveManualVisitsList(localTimeEntries)}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Check-Out Time")}</label>
                        <Input
                          type="datetime-local"
                          value={formatDateTimeForInput(entry.checkOutTime)}
                          onChange={(e) => handleUpdateVisitEntry(idx, 'checkOutTime', e.target.value)}
                          onBlur={() => handleSaveManualVisitsList(localTimeEntries)}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                onClick={handleSaveManualVisits}
                disabled={isSavingManualVisits}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                {isSavingManualVisits ? t("Saving...") : t("Save Manual Time Logs")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 1.6 Twilio Check-In Engine Widget */}
      <div>
        <OneClickCheckInWidget
          job={job}
          customer={customer}
          currentUser={state.currentUser}
          onCheckInSuccess={() => onCheckIn && onCheckIn()}
          onCheckOutSuccess={() => onStopClock && onStopClock()}
          defaultExpanded={false}
        />
      </div>

      {/* 1.7 Job In Progress Action Panel: Track Parts Used & Repair Postponement */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Package size={18} className="text-primary-600" />
              {t("Job In Progress")}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t("Track all parts used and job postponement state.")}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAddPartModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <QrCode size={14} className="text-primary-600" />
              <span>{t("Scan Part")}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddPartModal(true)}
              className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>{t("Add Part")}</span>
            </button>
            <button
              type="button"
              onClick={onOpenTools}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles size={14} />
              <span>{t("AI Assist")}</span>
            </button>
          </div>
        </div>

        {/* On-Site Sub-Location / Building Work Area Switcher */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Building2 size={13} className="text-blue-600 dark:text-blue-400" />
              <span>{t("Active On-Site Sub-Location / Building")}</span>
            </label>
            {activeSubLocationName && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded-md">
                📍 {activeSubLocationName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={activeSubLocationId || ''}
              onChange={(e) => {
                const selectedId = e.target.value;
                const matchLoc = siteSubLocationsOnly.find((l: any) => l.id === selectedId) as any;
                const locName = matchLoc ? (matchLoc.subLocationName || matchLoc.building || matchLoc.propertyName || matchLoc.name) : selectedId;
                handleSelectSubLocation(selectedId, locName || '');
              }}
              className="flex-1 min-w-0 p-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="">-- {t("Select Sub-Location / Building")} --</option>
              {siteSubLocationsOnly.map((loc: any) => {
                const locAny = loc as any;
                const nameStr = locAny.subLocationName || locAny.building || locAny.propertyName || locAny.name || 'Building';
                return (
                  <option key={loc.id} value={loc.id}>
                    🏢 {nameStr} {loc.building && loc.building !== nameStr ? `(${loc.building})` : ''}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              onClick={() => setIsAddSubLocationOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
              title={t("Add new sub-location or building")}
            >
              <Plus size={14} />
              <span>{t("+ Add Sub-Location")}</span>
            </button>
          </div>
        </div>

        {/* Consumed Parts List if any */}
        {job.consumedParts && job.consumedParts.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              {t("Parts & Materials Consumed")} ({job.consumedParts.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {job.consumedParts.map((p: any, idx: number) => (
                <div key={p.id || idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                    <span className="text-[10px] text-slate-400">Qty: {p.quantity} &bull; {p.location || 'Truck Stock'}</span>
                  </div>
                  {p.price > 0 && (
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">${(p.price * (p.quantity || 1)).toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Repair Postponed / Return Visit Required Checkbox */}
        <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <input
              id="dash-postpone-chk"
              type="checkbox"
              checked={repairPostponed}
              onChange={(e) => handleTogglePostponed(e.target.checked)}
              className="h-4.5 w-4.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="dash-postpone-chk" className="font-bold text-xs text-amber-950 dark:text-amber-200 cursor-pointer">
              {t("Repair Postponed / Return Visit Required")}
            </label>
          </div>

          {repairPostponed && (
            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 animate-fade-in flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="text-[10px] font-extrabold uppercase text-amber-800 dark:text-amber-400 shrink-0">
                {t("Reason for Postponement:")}
              </label>
              <select
                value={repairPostponedReason}
                onChange={(e) => {
                  setRepairPostponedReason(e.target.value);
                  handleTogglePostponed(true, e.target.value);
                }}
                className="w-full sm:flex-1 text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-slate-800 dark:text-slate-200 font-bold"
              >
                <option value="">-- {t("Select a Reason")} --</option>
                <option value="Waiting for Parts">{t("Waiting for Parts")}</option>
                <option value="Waiting for Customer/Insurance Approval">{t("Waiting for Customer/Insurance Approval")}</option>
                <option value="Technician returning another day">{t("Technician returning another day")}</option>
                <option value="Other">{t("Other (specify in job notes)")}</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 2. Site Equipment Section (The Core Workspace) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="text-primary-600" size={22} />
              {t("Site Equipment & Assets")} ({assets.length})
            </h2>
            <p className="text-xs text-slate-500">{t("Tap any unit to perform diagnosis, readings, photos, or on-the-spot repairs.")}</p>
          </div>
          <Button
            type="button"
            onClick={onAddEquipment}
            className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs h-10 flex items-center gap-1.5 px-4 rounded-xl shadow-sm"
          >
            <Plus size={16} />
            {t("Add New Unit")}
          </Button>
        </div>

        {/* Sub-Location Filter Tabs */}
        {locationFilters.length > 2 && (
          <div className="flex gap-2 overflow-x-auto py-1 custom-scrollbar">
            {locationFilters.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setActiveLocationFilter(loc)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  activeLocationFilter === loc
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        )}

        {/* Equipment Cards Grid */}
        {filteredAssets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssets.map((asset) => {
              const uState = getUnitStateForAsset(asset.id);
              const assetPhotos = (() => {
                const combined = [...(files || []), ...(job.files || [])];
                const list: any[] = [];
                const seen = new Set<string>();

                const addP = (url?: string, label?: string) => {
                  if (!url || seen.has(url)) return;
                  seen.add(url);
                  list.push({ url, dataUrl: url, label: label || 'Unit Photo' });
                };

                addP(asset.unitTagPhotoUrl, 'Data Plate');
                addP(asset.dataPlatePhotoUrl, 'Data Plate');
                addP(asset.photoUrl, 'Unit Photo');
                addP(uState.beforePhotoUrl, 'Before');
                addP(uState.afterPhotoUrl, 'After');
                addP(uState.dataPlatePhotoUrl, 'Data Plate');
                addP(uState.photoUrl, 'Unit Photo');

                if (Array.isArray(uState.photos)) {
                  uState.photos.forEach((p: any) => {
                    const u = typeof p === 'string' ? p : (p?.url || p?.dataUrl);
                    addP(u, 'Unit Photo');
                  });
                }

                combined.forEach(f => {
                  const url = f.dataUrl || f.url;
                  const isImg = f.fileType?.startsWith('image/') || 
                                (f as any).contentType?.startsWith('image/') || 
                                (url && url.match(/\.(jpeg|jpg|png|webp|gif|heic)($|\?)/i)) || 
                                f.fileName?.match(/\.(jpeg|jpg|png|webp|gif|heic)$/i);
                  if (!isImg || !url) return;

                  const fAssetId = (f.metadata?.assetId || f.assetId || '').toLowerCase().trim();
                  const aId = (asset.id || '').toLowerCase().trim();

                  if (fAssetId && aId && fAssetId === aId) {
                    addP(url, f.metadata?.label || f.label || 'Unit Photo');
                  } else if (!fAssetId && filteredAssets.length === 1) {
                    addP(url, f.metadata?.label || f.label || 'Unit Photo');
                  }
                });

                return list;
              })();
              const itemReqCount = uState.unitLineItems?.length || 0;
              const hasFix = uState.onTheSpotRepairs && uState.onTheSpotRepairs.length > 0;

              const sysKey = getSystemKey(asset);
              const sysGroupIdx = sysKey ? (systemGroupsMap.get(sysKey) ?? -1) : -1;
              const sysColor = sysGroupIdx >= 0 ? getSystemColor(sysGroupIdx) : null;
              const sysDisplayLabel = asset.systemGroupName || asset.systemGroup || asset.systemName || asset.system_name || asset.circuitId || asset.circuit_id || (sysGroupIdx >= 0 ? `System #${sysGroupIdx + 1}` : null);

              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  style={sysColor ? { borderLeft: sysColor.borderLeftStyle } : undefined}
                  className={`p-5 bg-white dark:bg-slate-900 rounded-2xl border ${sysColor ? 'border-l-0 shadow-xs' : 'border-slate-200 dark:border-slate-800'} ${uState.notServicedToday ? 'opacity-75 bg-slate-50/70 dark:bg-slate-900/60' : ''} shadow-sm hover:shadow-md hover:border-primary-500 dark:hover:border-primary-500 transition-all cursor-pointer space-y-4 group relative overflow-hidden`}
                >
                  {/* Top Banner if Not Serviced Today */}
                  {uState.notServicedToday && (
                    <div className="bg-amber-500 text-white text-[10px] font-black uppercase px-3 py-1 -mx-5 -mt-5 mb-3 flex items-center justify-between gap-2 shadow-2xs">
                      <span className="flex items-center gap-1.5">
                        <span>🚫</span>
                        <span>{t("Not Serviced Today — Excluded from Visit Report")}</span>
                      </span>
                      <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded font-extrabold">
                        {t("This Visit Only")}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {getHealthBadge(uState.healthBefore, uState.healthAfter, uState.health)}
                        {sysDisplayLabel && sysColor && (
                          <span
                            className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border shadow-2xs flex items-center gap-1"
                            style={sysColor.badgeStyle}
                          >
                            🔗 {sysDisplayLabel}
                          </span>
                        )}
                        {asset.location && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {typeof asset.location === 'string' ? asset.location : (typeof asset.location === 'object' ? (asset.location.name || asset.location.label || String(asset.location)) : String(asset.location))}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                        {asset.name || asset.title || (asset.model ? `${asset.brand || ''} ${asset.model}`.trim() : `${asset.brand || ''} ${asset.type || 'Equipment Unit'}`.trim())}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {asset.brand || 'Serviced Unit'} • Mod: {asset.model || asset.modelNumber || 'N/A'} • S/N: {asset.serial || asset.serialNumber || 'N/A'}
                      </p>
                      {(() => {
                        const lat = typeof asset.gpsPin?.lat === 'number' ? asset.gpsPin.lat : (typeof asset.gpsLat === 'number' ? asset.gpsLat : undefined);
                        const lng = typeof asset.gpsPin?.lng === 'number' ? asset.gpsPin.lng : (typeof asset.gpsLng === 'number' ? asset.gpsLng : undefined);
                        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
                          return (
                            <a
                              href={`https://www.google.com/maps?q=${lat},${lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mt-1 hover:underline cursor-pointer"
                              title={t("Open coordinates in Google Maps")}
                            >
                              <Compass size={11} className="text-blue-500 shrink-0" />
                              <span>GPS: {lat.toFixed(6)}, {lng.toFixed(6)}</span>
                              <ExternalLink size={10} className="shrink-0 opacity-70" />
                            </a>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Edit Asset Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditAssetModal(asset);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-blue-600 dark:text-slate-300 text-[10px] font-extrabold uppercase rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        title={t("Edit equipment details")}
                      >
                        <Pencil size={11} className="text-blue-600 dark:text-blue-400" />
                        <span>{t("Edit")}</span>
                      </button>

                      {/* Toggle: Not Serviced Today */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleNotServiced(asset.id, !uState.notServicedToday);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer border ${
                          uState.notServicedToday
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                        title={t("Toggle whether this unit was serviced during today's visit")}
                      >
                        {uState.notServicedToday ? (
                          <>
                            <span>🚫</span>
                            <span>{t("Not Serviced Today")}</span>
                          </>
                        ) : (
                          <>
                            <span className="opacity-60">⚪</span>
                            <span>{t("Not Serviced Today?")}</span>
                          </>
                        )}
                      </button>
                      <ChevronRight size={20} className="text-slate-400 group-hover:text-primary-600 transition-colors shrink-0" />
                    </div>
                  </div>

                  {/* Summary Status Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {uState.diagnosis ? (
                      <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                        <CheckCircle size={12} /> {t("Diagnosis Logged")}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-lg font-semibold">
                        {t("Pending Inspection")}
                      </span>
                    )}

                    {assetPhotos.length > 0 && (
                      <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                        <Camera size={12} /> {assetPhotos.length} {t("Photos")}
                      </span>
                    )}

                    {hasFix && (
                      <span className="bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                        <Zap size={12} /> {t("⚡ On-The-Spot Fix")}
                      </span>
                    )}

                    {itemReqCount > 0 && (
                      <span className="bg-purple-100 text-purple-900 dark:bg-purple-950/40 dark:text-purple-300 px-2.5 py-1 rounded-lg font-bold">
                        +{itemReqCount} {t("Proposal Items")}
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Row of Unit & Data Plate Photos */}
                  {assetPhotos.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 overflow-x-auto custom-scrollbar">
                      {assetPhotos.slice(0, 5).map((p: any, pIdx: number) => (
                        <div
                          key={p.id || pIdx}
                          className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-2xs relative group/thumb"
                        >
                          <img
                            src={p.dataUrl || p.url}
                            alt={p.label || 'Unit Photo'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {assetPhotos.length > 5 && (
                        <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black flex items-center justify-center border border-slate-300 dark:border-slate-700 shrink-0">
                          +{assetPhotos.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/50 space-y-3">
            <Cpu size={36} className="text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
              {activeSubLocationName 
                ? t(`No equipment assets registered at ${activeSubLocationName} yet.`)
                : t("No equipment assets registered at this site location yet.")}
            </p>
            <Button type="button" onClick={onAddEquipment} className="bg-primary-600 text-white font-bold text-xs px-4 py-2">
              {activeSubLocationName 
                ? t(`+ Register Equipment for ${activeSubLocationName}`)
                : t("+ Register Site Equipment")}
            </Button>
          </div>
        )}
      </div>

      {/* Job Photos & Media Gallery Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Camera size={18} className="text-primary-600" />
              {t("Job Photos & Media Gallery")}
              <span className="text-xs font-bold bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300 px-2 py-0.5 rounded-full">
                {allJobPhotos.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("View, upload, and organize all photos taken on site (Before, After, Unit Tags & Data Plates).")}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Upload Tag Selection */}
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="Before">🏷️ Tag: Before</option>
              <option value="After">🏷️ Tag: After</option>
              <option value="Data Plate">🏷️ Tag: Data Plate</option>
              <option value="Defect / Damage">🏷️ Tag: Defect</option>
              <option value="Electrical">🏷️ Tag: Electrical</option>
              <option value="General">🏷️ Tag: General Photo</option>
            </select>

            {/* Equipment Unit Target Selection */}
            {assets && assets.length > 0 && (
              <select
                value={uploadAssetId}
                onChange={(e) => setUploadAssetId(e.target.value)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
              >
                <option value="general">📍 Target: General Site</option>
                {assets.map((a) => {
                  const serialText = a.serial || a.serialNumber ? ` • S/N: ${a.serial || a.serialNumber}` : '';
                  const modelText = a.model || a.modelNumber ? ` • M/N: ${a.model || a.modelNumber}` : '';
                  const brandText = a.brand ? ` (${a.brand})` : '';
                  return (
                    <option key={a.id} value={a.id}>
                      ⚙️ Target: {a.name || 'Unit'}{brandText}{modelText}{serialText}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Camera / Native Photo Button */}
            {takeNativePhoto && (
              <Button
                type="button"
                onClick={() => takeNativePhoto(uploadCategory, uploadAssetId !== 'general' ? uploadAssetId : undefined)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <Camera size={14} />
                <span>{t("Camera")}</span>
              </Button>
            )}

            {/* Gallery Multi-Photo Button */}
            {pickGalleryPhotos && (
              <Button
                type="button"
                onClick={() => pickGalleryPhotos(uploadCategory, uploadAssetId !== 'general' ? uploadAssetId : undefined)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <ImageIcon size={14} />
                <span>{t("Gallery")}</span>
              </Button>
            )}

            {/* File Upload Button */}
            <label className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0">
              <Plus size={14} />
              <span>{t("Upload Photo")}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleDashboardPhotoUpload}
              />
            </label>
          </div>
        </div>

        {/* Gallery Filter Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900 overflow-x-auto p-1.5 gap-1.5 custom-scrollbar">
          {[
            { id: 'all', label: t('All Media'), count: allJobPhotos.length },
            { id: 'before', label: t('Before Photos'), count: allJobPhotos.filter(f => (f.label || f.categoryLabel || f.metadata?.label || '').toLowerCase().includes('before')).length },
            { id: 'after', label: t('After Photos'), count: allJobPhotos.filter(f => (f.label || f.categoryLabel || f.metadata?.label || '').toLowerCase().includes('after')).length },
            { id: 'units', label: t('Units & Data Plates'), count: allJobPhotos.filter(f => (f.label || f.categoryLabel || f.metadata?.label || '').toLowerCase().includes('unit') || (f.label || f.categoryLabel || f.metadata?.label || '').toLowerCase().includes('plate') || f.metadata?.assetId || f.assetId).length },
            { id: 'docs', label: t('Documents & PDFs'), count: (job.files || files || []).filter((f: any) => (f.fileType || f.contentType || '').toLowerCase().includes('pdf') || (f.fileName || f.name || '').toLowerCase().endsWith('.pdf')).length }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setGalleryFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                galleryFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs font-extrabold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                galleryFilter === tab.id ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Photos Grid Container */}
        <div className="p-4">
          {filteredGalleryPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredGalleryPhotos.map((photo: any, pIdx: number) => {
                const imgUrl = photo.dataUrl || photo.url;
                const label = photo.label || photo.categoryLabel || photo.metadata?.label || 'Photo';
                const isPdf = (photo.fileType && photo.fileType.includes('pdf')) || (photo.fileName && photo.fileName.endsWith('.pdf'));

                return (
                  <div
                    key={photo.id || pIdx}
                    className="group relative bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col"
                  >
                    {/* Thumbnail / Document Preview */}
                    <div
                      className="aspect-square w-full relative overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-pointer"
                      onClick={() => {
                        if (isPdf) {
                          window.open(imgUrl, '_blank');
                        } else if (onViewPhoto) {
                          onViewPhoto(photo);
                        }
                      }}
                    >
                      {isPdf ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-slate-600 dark:text-slate-400">
                          <FileText size={32} className="text-red-500 mb-1" />
                          <span className="text-[10px] font-bold truncate w-full">{photo.fileName || photo.name}</span>
                        </div>
                      ) : (
                        <img
                          src={imgUrl}
                          alt={label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      )}

                      {/* Tag Badge */}
                      <span className={`absolute top-1.5 left-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-2xs ${
                        label.toLowerCase().includes('before')
                          ? 'bg-blue-600 text-white'
                          : label.toLowerCase().includes('after')
                          ? 'bg-emerald-600 text-white'
                          : label.toLowerCase().includes('plate') || label.toLowerCase().includes('data')
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-900/80 text-white backdrop-blur-xs'
                      }`}>
                        {label}
                      </span>
                    </div>

                    {/* Footer Info & Actions */}
                    <div className="p-2 bg-white dark:bg-slate-900 flex items-center justify-between gap-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate">
                          {photo.fileName || photo.name || label}
                        </p>
                        {photo.uploadedBy && (
                          <p className="text-[9px] text-slate-400 truncate">
                            {photo.uploadedBy}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditPhotoModal(photo);
                          }}
                          className="text-slate-400 hover:text-blue-500 p-1 rounded transition-colors"
                          title={t("Edit Photo Label & Unit Tag")}
                        >
                          <Pencil size={12} />
                        </button>
                        {onDeletePhoto && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePhoto(photo);
                            }}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                            title={t("Delete Photo")}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900/40 space-y-2">
              <Camera size={32} className="text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {t("No photos or files found for this filter.")}
              </p>
              <p className="text-[11px] text-slate-400">
                {t("Use the camera or upload buttons above to attach site photos.")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Job Completion Notes, Recommendations & Thank You Note Unified Tabbed Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileText size={18} className="text-primary-600" />
              {t("Job Documentation & Notes")}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t("Select a tab to edit completion notes, recommendations, or customer thank-you note.")}</p>
          </div>

          <Button
            type="button"
            onClick={handleSaveJobNotes}
            disabled={isSavingNotes}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <CheckCircle2 size={14} />
            {isSavingNotes ? t("Saving...") : t("Save Notes")}
          </Button>
        </div>

        {/* Tab Header Bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveNotesTab('general')}
            className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeNotesTab === 'general'
                ? 'border-blue-600 text-blue-600 bg-white dark:bg-slate-900 dark:text-blue-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ClipboardList size={15} />
            <span>{t("Notes")}</span>
            {generalNotes.trim() ? <span className="w-2 h-2 rounded-full bg-blue-500" /> : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveNotesTab('completion')}
            className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeNotesTab === 'completion'
                ? 'border-emerald-600 text-emerald-600 bg-white dark:bg-slate-900 dark:text-emerald-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileText size={15} />
            <span>{t("Job Completion Notes")}</span>
            {completionNotes.trim() ? <span className="w-2 h-2 rounded-full bg-emerald-500" /> : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveNotesTab('recommendations')}
            className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeNotesTab === 'recommendations'
                ? 'border-purple-600 text-purple-600 bg-white dark:bg-slate-900 dark:text-purple-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Wrench size={15} />
            <span>{t("Direct Recommendations")}</span>
            {techRecommendations.trim() ? <span className="w-2 h-2 rounded-full bg-purple-500" /> : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveNotesTab('thankyou')}
            className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeNotesTab === 'thankyou'
                ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-slate-900 dark:text-indigo-400 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Heart size={15} />
            <span>{t("Thank You Note")}</span>
            {thankYouNote.trim() ? <span className="w-2 h-2 rounded-full bg-indigo-500" /> : null}
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 text-left">
          {activeNotesTab === 'general' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300">
                  🔒 VISIBILITY: INTERNAL / ARRIVAL NOTES / JOB RECORD
                </span>
                <VoiceInput onResult={(text) => setGeneralNotes(prev => (prev ? prev + ' ' + text : text))} />
              </div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">{t("General Notes & Arrival Observations")}</h4>
              <p className="text-xs text-slate-500">{t("Arrival notes, initial technician observations, and general site notes.")}</p>
              <Textarea 
                rows={4} 
                value={generalNotes} 
                onChange={e => setGeneralNotes(e.target.value)} 
                placeholder={t("Enter general job notes, arrival notes, or site observations...")} 
                className="bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          )}
          {activeNotesTab === 'completion' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                  🔒 VISIBILITY: CUSTOMER / INVOICE / JOB RECORD HISTORY
                </span>
                <VoiceInput onResult={(text) => setCompletionNotes(prev => (prev ? prev + ' ' + text : text))} />
              </div>
              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">{t("Job Completion Notes")}</h4>
              <Textarea 
                rows={4} 
                value={completionNotes} 
                onChange={e => setCompletionNotes(e.target.value)} 
                placeholder={t("Summary for invoice...")} 
                className="bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          )}

          {activeNotesTab === 'recommendations' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300">
                  🔒 VISIBILITY: PROPERTY MANAGER / CUSTOMER / PROPOSAL / INVOICE
                </span>
                <VoiceInput onResult={(text) => setTechRecommendations(prev => (prev ? prev + ' ' + text : text))} />
              </div>
              <h4 className="font-extrabold text-xs text-purple-900 dark:text-purple-300 uppercase tracking-wider">{t("Direct Technician Recommendations")}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("These recommendations push directly to the customer portal and job history immediately, bypassing any billing or proposal gates.")}
              </p>
              <Textarea 
                rows={4} 
                value={techRecommendations} 
                onChange={e => setTechRecommendations(e.target.value)} 
                placeholder={t("Enter recommendations for the customer/property manager...")} 
                className="bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          )}

          {activeNotesTab === 'thankyou' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300">
                  🔒 VISIBILITY: CUSTOMER MESSAGE
                </span>
                <VoiceInput onResult={(text) => setThankYouNote(prev => (prev ? prev + ' ' + text : text))} />
              </div>
              <h4 className="font-extrabold text-xs text-blue-900 dark:text-blue-300 uppercase tracking-wider">{t("Technician Thank You Note")}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("Personalize a thank you message to show on the customer's job report.")}
              </p>
              <Textarea 
                rows={4} 
                value={thankYouNote} 
                onChange={e => setThankYouNote(e.target.value)} 
                placeholder={t("e.g. Thank you for your business! It was a pleasure servicing your equipment today. Please let us know if you need anything else.")} 
                className="bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Job-Wide Action Grid (Checklists, Proposals, Tools, Billing) */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="text-primary-600" size={22} />
            {t("Job-Wide Tools & Actions")}
          </h2>
          <p className="text-xs text-slate-500">{t("Site checklists, proposal builder, diagnostic calculators, and billing sign-off.")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Checklists & Waivers */}
          <div
            onClick={onOpenChecklists}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-500 transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {t("Checklists & Waivers")}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{t("Safety procedures, arrival intake, and liability sign-offs.")}</p>
            </div>
          </div>

          {/* Card 2: Field Proposals & Estimator */}
          <div
            onClick={onOpenProposals}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-purple-500 transition-all cursor-pointer space-y-3 group relative overflow-hidden"
          >
            {totalUnitProposalItems > 0 && (
              <span className="absolute top-3 right-3 bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                {totalUnitProposalItems} {t("Items Ready")}
              </span>
            )}
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center font-bold">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                {t("Field Proposals")}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{t("Auto-aggregate unit repair items into Good/Better/Best options.")}</p>
            </div>
          </div>

          {/* Card 3: Tech Diagnostic Tools */}
          <div
            onClick={onOpenTools}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-amber-500 transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold">
              <Wrench size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                {t("Tech Diagnostics")}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{t("Refrigerant recovery log, calculators, and Bluetooth tools.")}</p>
            </div>
          </div>

          {/* Card 4: Billing, Sign-off & Invoicing */}
          <div
            onClick={onOpenBilling}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
              <CreditCard size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                {t("Billing & Sign-Off")}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{t("Verification outcomes, customer signatures & sign-off exceptions.")}</p>
            </div>
          </div>
        </div>

        {/* CUSTOMER SPECIFIC SUBMISSION RULES / COMMERCIAL WORK ORDER COMPLIANCE PROTOCOL */}
        {hasCustomerRules && (
          <div className="mt-6">
            <CommercialWorkOrderProcessGuide
              job={job}
              customer={customer}
              defaultExpanded={true}
            />
          </div>
        )}
      </div>

      {/* Selected Unit Modal */}
      {selectedAsset && (
        <UnitWorkModal
          isOpen={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
          asset={selectedAsset}
          job={job}
          unitState={getUnitStateForAsset(selectedAsset.id)}
          onSaveUnitState={async (updatedUnitState) => {
            try {
              const stateWithAsset = {
                ...updatedUnitState,
                assetId: selectedAsset.id
              };

              // If updatedUnitState has photos, ensure they are merged atomically into job.files
              let combinedFiles: StoredFile[] | null = null;
              if (Array.isArray(updatedUnitState.photos) && updatedUnitState.photos.length > 0) {
                const allExisting = [...(files || []), ...(job.files || [])];
                const seenKeys = new Set<string>();
                const currentJobFiles = allExisting.filter((f: any) => {
                  const key = f.id || f.dataUrl || f.url;
                  if (!key || seenKeys.has(key)) return false;
                  seenKeys.add(key);
                  return true;
                });
                const newPhotos = updatedUnitState.photos.filter((p: any) => {
                  const pId = p.id || p.url || p.dataUrl;
                  return !currentJobFiles.some((f: any) => (f.id || f.url || f.dataUrl) === pId);
                });
                if (newPhotos.length > 0) {
                  combinedFiles = [...currentJobFiles, ...newPhotos];
                }
              }

              // Compute unified unitStates array
              const currentStates = unitStates || [];
              const targetId = stateWithAsset.assetId;
              const idx = currentStates.findIndex((s: any) => s.assetId === targetId);
              const newStates = idx >= 0
                ? currentStates.map((s: any, i: number) => i === idx ? { ...s, ...stateWithAsset } : s)
                : [...currentStates, stateWithAsset];

              if (onJobUpdate) {
                const updatePayload: any = { unitStates: newStates };
                if (combinedFiles) {
                  updatePayload.files = combinedFiles;
                }
                await onJobUpdate(updatePayload);
              } else {
                await Promise.resolve(onUpdateUnitState(stateWithAsset));
              }
            } catch (saveErr) {
              console.error("Error saving unit state:", saveErr);
            }
          }}
          onAddInvoiceLineItem={onAddInvoiceLineItem}
          takeNativePhoto={takeNativePhoto}
          pickGalleryPhotos={pickGalleryPhotos}
          unitPhotos={(() => {
            const allExisting = [...(files || []), ...(job.files || [])];
            const seenKeys = new Set<string>();
            const currentFiles = allExisting.filter((f: any) => {
              const key = f.id || f.dataUrl || f.url;
              if (!key || seenKeys.has(key)) return false;
              seenKeys.add(key);
              return true;
            });
            return currentFiles.filter((f) => {
              const url = f.dataUrl || f.url;
              const isImg = f.fileType?.startsWith('image/') || (f as any).contentType?.startsWith('image/') || f.type === 'Photo' || (url && url.match(/\.(jpeg|jpg|png|webp|gif|heic)($|\?)/i));
              if (!isImg) return false;

              const fAssetId = (f.metadata?.assetId || f.assetId || '').toLowerCase().trim();
              const aId = (selectedAsset.id || '').toLowerCase().trim();

              // If explicitly tagged for this asset, include
              if (fAssetId && aId && fAssetId === aId) return true;
              // If explicitly tagged for another asset, exclude
              if (fAssetId && aId && fAssetId !== aId) return false;

              // If untagged, only include in unit modal if there is only 1 asset on the job
              return !fAssetId && (assets?.length || 0) <= 1;
            });
          })()}
          onDeletePhoto={onDeletePhoto}
          onViewPhoto={onViewPhoto}
          onEditAssetDetails={(assetToEdit) => {
            setSelectedAsset(null);
            handleOpenEditAssetModal(assetToEdit);
          }}
        />
      )}

      {/* Send Email Modal */}
      {isEmailModalOpen && (
        <SendEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          recipientEmail={job.customerEmail || ''}
          recipientName={job.customerName || ''}
          customerId={job.customerId}
          job={job}
          invoice={job.invoice}
          proposal={job.proposal}
          mode="email"
          defaultSubject={`Update regarding Work Order #${job.poNumber || job.id.slice(-6).toUpperCase()}`}
          defaultMessage={`Hello ${job.customerName || 'Customer'},\n\nThis is an update regarding your service visit at ${typeof job.address === 'string' ? job.address : 'your service address'}.\n\nBest regards,\nYour Service Team`}
        />
      )}

      {isSmsModalOpen && (
        <SendSMSModal
          isOpen={isSmsModalOpen}
          onClose={() => setIsSmsModalOpen(false)}
          customerId={job.customerId}
          recipientPhone={job.customerPhone}
          recipientName={job.customerName}
        />
      )}

      {/* Linked Document Viewer Modals */}
      {viewingProposal && (
        <DocumentPreview
          type="Proposal"
          data={viewingProposal}
          onClose={() => setViewingProposal(null)}
        />
      )}

      {viewingInvoiceJob && (
        <DocumentPreview
          type="Invoice"
          data={viewingInvoiceJob}
          onClose={() => setViewingInvoiceJob(null)}
          isInternal={true}
        />
      )}

      {previewOtherDoc && (
        <DocumentPreview
          type="Other"
          data={previewOtherDoc}
          onClose={() => setPreviewOtherDoc(null)}
          isInternal={true}
        />
      )}

      {/* Add Consumed Part Modal */}
      {showAddPartModal && (
        <Modal
          isOpen={showAddPartModal}
          onClose={() => setShowAddPartModal(false)}
          title={t("Add Consumed Part or Material")}
          size="sm"
        >
          <div className="space-y-4 text-xs p-1">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">{t("Part / Material Name *")}</label>
              <Input
                placeholder="e.g., 45/5 MFD Dual Capacitor, 16x25x1 Air Filter"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">{t("Quantity *")}</label>
                <Input
                  type="number"
                  min="1"
                  value={partQty}
                  onChange={(e) => setPartQty(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">{t("Unit Price ($)")}</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={partPrice}
                  onChange={(e) => setPartPrice(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">{t("Inventory Source / Location")}</label>
              <select
                value={partLocation}
                onChange={(e) => setPartLocation(e.target.value)}
                className="w-full p-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold"
              >
                <option value="Truck Stock">{t("Truck Stock")}</option>
                <option value="Main Warehouse">{t("Main Warehouse")}</option>
                <option value="Vendor Purchased">{t("Vendor Purchased (Johnstone/Grainger)")}</option>
                <option value="Customer Supplied">{t("Customer Supplied")}</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setShowAddPartModal(false)}>
                {t("Cancel")}
              </Button>
              <Button size="sm" onClick={handleSavePartToJob}>
                {t("Save & Attach Part")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add New Sub-Location / Building */}
      {isAddSubLocationOpen && (
        <Modal 
          isOpen={isAddSubLocationOpen} 
          onClose={() => setIsAddSubLocationOpen(false)} 
          title={t("Add New Sub-Location / Building")}
        >
          <div className="space-y-4 text-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("Add a new building, suite, or campus area for this site location. This allows you to differentiate equipment, photos, and vitals between buildings while on site.")}
            </p>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                {t("Sub-Location / Building Name *")}
              </label>
              <Input 
                placeholder={t("e.g. Science Hall / Building B / Suite 400 / Mech Room 2")}
                value={newSubLocName}
                onChange={e => setNewSubLocName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                {t("Building / Floor / Wing (Optional)")}
              </label>
              <Input 
                placeholder={t("e.g. Floor 3, East Wing")}
                value={newSubLocBuilding}
                onChange={e => setNewSubLocBuilding(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                {t("Access Notes / Specific Details (Optional)")}
              </label>
              <Textarea 
                placeholder={t("e.g. Keycard required for elevator, roof hatch in room 302")}
                value={newSubLocNotes}
                onChange={e => setNewSubLocNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button 
                variant="secondary" 
                onClick={() => setIsAddSubLocationOpen(false)}
              >
                {t("Cancel")}
              </Button>
              <Button 
                onClick={handleAddSubLocationSubmit} 
                disabled={isSavingSubLoc || !newSubLocName.trim()} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {isSavingSubLoc ? t("Creating...") : t("Add & Switch to Sub-Location")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Asset Details Modal */}
      {editingAsset && (
        <Modal
          isOpen={Boolean(editingAsset)}
          onClose={() => setEditingAsset(null)}
          title={`Edit Equipment Details: ${editingAsset.name || 'Unit'}`}
          size="md"
        >
          <div className="space-y-4 text-slate-800 dark:text-slate-200">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {t("Unit / Asset Name")} *
              </label>
              <Input
                type="text"
                value={editAssetName}
                onChange={(e) => setEditAssetName(e.target.value)}
                placeholder="e.g. Air Handler #1, Rooftop Unit 2, Heat Pump"
                className="w-full text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("Manufacturer / Brand")}
                </label>
                <Input
                  type="text"
                  value={editAssetBrand}
                  onChange={(e) => setEditAssetBrand(e.target.value)}
                  placeholder="e.g. Rheem, Trane, Carrier"
                  className="w-full text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("Model Number")}
                </label>
                <Input
                  type="text"
                  value={editAssetModel}
                  onChange={(e) => setEditAssetModel(e.target.value)}
                  placeholder="e.g. RHSL-HM2417JA"
                  className="w-full text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("Serial Number")}
                </label>
                <Input
                  type="text"
                  value={editAssetSerial}
                  onChange={(e) => setEditAssetSerial(e.target.value)}
                  placeholder="e.g. W123456789"
                  className="w-full text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("Sub-Location / Building")}
                </label>
                <select
                  value={editAssetLocation}
                  onChange={(e) => setEditAssetLocation(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- {t("Select or Enter Sub-Location")} --</option>
                  {serviceLocations.map((loc: any) => {
                    const locName = loc.subLocationName || loc.building || loc.name;
                    return (
                      <option key={loc.id} value={locName}>
                        🏢 {locName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("System Group Name (For Linked Pairing)")}
                </label>
                <Input
                  type="text"
                  value={editAssetSystemGroup}
                  onChange={(e) => setEditAssetSystemGroup(e.target.value)}
                  placeholder="e.g. System #1, Circuit A"
                  className="w-full text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("Link to Paired Unit / Asset")}
                </label>
                <select
                  value={editAssetLinkedId}
                  onChange={(e) => setEditAssetLinkedId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- {t("No Link (Standalone)")} --</option>
                  {assets
                    .filter((other: any) => other.id !== editingAsset.id)
                    .map((other: any) => (
                      <option key={other.id} value={other.id}>
                        🔗 {other.name || 'Unit'} ({other.model || 'No Mod'})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* GPS Coordinates Section */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Compass size={14} className="text-blue-600 dark:text-blue-400" />
                  <span>{t("Unit GPS Pin (Latitude / Longitude)")}</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUseJobSiteGps}
                    className="text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer"
                  >
                    {t("Use Job Site GPS")}
                  </button>
                  {(editAssetGpsLat || editAssetGpsLng) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditAssetGpsLat('');
                        setEditAssetGpsLng('');
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 underline cursor-pointer ml-1"
                    >
                      {t("Clear GPS")}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    {t("Latitude")}
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 37.774929"
                    value={editAssetGpsLat}
                    onChange={(e) => setEditAssetGpsLat(e.target.value)}
                    className="w-full text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    {t("Longitude")}
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. -122.419416"
                    value={editAssetGpsLng}
                    onChange={(e) => setEditAssetGpsLng(e.target.value)}
                    className="w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isGpsCapturing}
                  onClick={handleCaptureAssetGps}
                  className="text-xs flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                >
                  <Compass size={13} className={isGpsCapturing ? "animate-spin text-blue-600" : "text-blue-600"} />
                  {isGpsCapturing ? t("Acquiring GPS...") : t("📍 Capture Device GPS")}
                </Button>

                {(() => {
                  const latNum = parseFloat(editAssetGpsLat);
                  const lngNum = parseFloat(editAssetGpsLng);
                  if (!isNaN(latNum) && !isNaN(lngNum) && (latNum !== 0 || lngNum !== 0)) {
                    return (
                      <a
                        href={`https://www.google.com/maps?q=${latNum},${lngNum}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>Preview on Google Maps</span>
                        <ExternalLink size={10} />
                      </a>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {(((job as any)?.industry || (job as any)?.trade || state.currentOrganization?.industry || 'HVAC') as string).toUpperCase().includes('HVAC') && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t("Refrigerant Type")}
                </label>
                <select
                  value={editAssetRefrigerant}
                  onChange={(e) => setEditAssetRefrigerant(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="R-410A (Puron)">R-410A (Puron)</option>
                  <option value="R-22 (Freon)">R-22 (Freon)</option>
                  <option value="R-32">R-32</option>
                  <option value="R-454B (Opteon XL41)">R-454B (Opteon XL41)</option>
                  <option value="R-134a">R-134a</option>
                  <option value="R-404A">R-404A</option>
                  <option value="R-407C">R-407C</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingAsset(null)}
                className="text-xs px-4 py-2"
              >
                {t("Cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSaveAssetDetails}
                disabled={isSavingAsset}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-sm"
              >
                {isSavingAsset ? t("Saving...") : t("Save Equipment Details")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* PHOTO LABEL & UNIT TAGGING EDIT MODAL */}
      {editingPhoto && (
        <Modal
          isOpen={!!editingPhoto}
          onClose={() => setEditingPhoto(null)}
          title={
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Pencil className="text-blue-500" size={20} />
              <div>
                <h3 className="font-extrabold text-base">{t("Label & Tag Job Photo")}</h3>
                <p className="text-xs text-slate-500 font-normal">{t("Set photo category, assign to an equipment unit, and add custom notes.")}</p>
              </div>
            </div>
          }
          size="md"
        >
          <div className="space-y-4 py-2">
            {/* Image Preview */}
            <div className="w-full h-48 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 shadow-inner">
              <img
                src={editingPhoto.dataUrl || editingPhoto.url}
                alt={editingPhoto.label || 'Photo'}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Photo Category Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Photo Category / Tag")}</label>
              <select
                value={editLabelCategory}
                onChange={(e) => setEditLabelCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="Before">🏷️ Before (Pre-Work Inspection)</option>
                <option value="After">🏷️ After (Completed Repair)</option>
                <option value="Data Plate">🏷️ Data Plate / Nameplate</option>
                <option value="Defect / Damage">🏷️ Defect / Component Damage</option>
                <option value="Electrical">🏷️ Electrical / Wiring / Cap</option>
                <option value="General">🏷️ General Site Photo</option>
              </select>
            </div>

            {/* Unit Assignment Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Assign to Equipment Unit")}</label>
              <select
                value={editAssetId}
                onChange={(e) => {
                  const newAssetId = e.target.value;
                  setEditAssetId(newAssetId);
                  if (newAssetId !== 'general') {
                    const match = (assets || []).find((a: any) => a.id === newAssetId);
                    if (match && (!editCustomNotes || editCustomNotes.startsWith('RTU') || editCustomNotes === 'RTU 6')) {
                      setEditCustomNotes(match.name || match.title || '');
                    }
                  } else if (editCustomNotes.startsWith('RTU') || editCustomNotes === 'RTU 6') {
                    setEditCustomNotes('');
                  }
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="general">📍 General Job / All Units</option>
                {(assets || []).map((a) => {
                  const serialText = a.serial || a.serialNumber ? ` • S/N: ${a.serial || a.serialNumber}` : '';
                  const modelText = a.model || a.modelNumber ? ` • M/N: ${a.model || a.modelNumber}` : '';
                  const brandText = a.brand ? ` (${a.brand})` : '';
                  return (
                    <option key={a.id} value={a.id}>
                      ⚙️ {a.name || a.title || 'Equipment Unit'}{brandText}{modelText}{serialText}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Custom Notes / Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Custom Photo Notes / Description (Optional)")}</label>
              <input
                type="text"
                placeholder="e.g. Burnt dual run capacitor 45 MFD"
                value={editCustomNotes}
                onChange={(e) => setEditCustomNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              {onDeletePhoto ? (
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = editingPhoto;
                    setEditingPhoto(null);
                    onDeletePhoto(toDelete);
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-red-200 dark:border-red-800 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} /> {t("Delete Photo")}
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditingPhoto(null)}>
                  {t("Cancel")}
                </Button>
                <Button type="button" onClick={handleSavePhotoLabelEdit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl">
                  {t("Save Photo Tag")}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default JobDashboardView;
