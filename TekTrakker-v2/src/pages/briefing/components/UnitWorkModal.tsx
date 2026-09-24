import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Textarea from '../../../components/ui/Textarea';
import Input, { NumberInput } from '../../../components/ui/Input';
import { VoiceInput } from '../../../components/ui/VoiceInput';
import { StoredFile } from '../../../types';
import { useLanguage } from 'context/LanguageContext';
import { useAppContext } from 'context/AppContext';
import { isHvacTrade } from '../../../utils/tradeResolver';
import showToast from 'lib/toast';
import { uploadFileToStorage } from '../../../lib/storageService';
import { offlineSyncManager } from '../../../lib/offlineSyncManager';
import { compressFile, cleanUndefinedFields } from '../../../lib/utils';
import {
  Camera,
  Zap,
  Plus,
  Trash2,
  CheckCircle,
  Wrench,
  ShieldAlert,
  Cpu,
  Flame,
  Droplet,
  Thermometer,
  Gauge,
  Sparkles,
  RefreshCw,
  Sliders,
  Database,
  Download,
  Activity,
  FileCheck,
  AlertCircle,
  Calculator,
  ChevronDown,
  CheckCircle2,
  Upload,
  ShieldCheck,
  Pencil,
  Compass,
  ExternalLink,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { getCurrentLocation } from '../../../lib/geolocation';
import { db } from '../../../lib/firebase';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera } from '@capacitor/camera';

interface UnitLineItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  description?: string;
}

interface UnitWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: any;
  unitState: {
    assetId: string;
    health?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    healthBefore?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    healthAfter?: 'Good' | 'Fair' | 'Poor' | 'Critical';
    diagnosis?: string;
    repair?: string;
    recommendations?: string;
    tempSplit?: string;
    tempSplitBefore?: string;
    tempSplitAfter?: string;
    electricalReadings?: string;
    electricalReadingsBefore?: string;
    electricalReadingsAfter?: string;
    refrigerantReadings?: string;
    refrigerantReadingsBefore?: string;
    refrigerantReadingsAfter?: string;
    drainStatus?: 'Pass' | 'Fail' | 'N/A';
    thermostatStatus?: 'Pass' | 'Fail' | 'N/A';
    safetiesStatus?: 'Pass' | 'Fail' | 'N/A';
    refrigerantType?: string;
    refrigerantLbs?: number;
    refrigerantOz?: number;
    refrigerantAction?: 'Added' | 'Recovered' | 'Tested';
    cylinderTag?: string;
    unitLineItems?: UnitLineItem[];
    beforePhotoUrl?: string;
    afterPhotoUrl?: string;
    photoUrl?: string;
    photos?: any[];
    onTheSpotRepairs?: Array<{
      description: string;
      fee: number;
      timestamp: string;
    }>;
    notServicedToday?: boolean;
  };
  onSaveUnitState: (updatedState: any) => void;
  onAddInvoiceLineItem?: (item: { name: string; amount: number; description: string }) => void;
  takeNativePhoto?: (label: string, assetId?: string) => void;
  pickGalleryPhotos?: (label: string, assetId?: string) => void;
  unitPhotos?: StoredFile[];
  onDeletePhoto?: (file: StoredFile) => void;
  onViewPhoto?: (file: StoredFile) => void;
  onUploadPhoto?: (file: File, label?: string, assetId?: string) => void;
  onEditAssetDetails?: (asset: any) => void;
  job?: any;
}

const UnitWorkModal: React.FC<UnitWorkModalProps> = ({
  isOpen,
  onClose,
  asset,
  unitState,
  onSaveUnitState,
  onAddInvoiceLineItem,
  takeNativePhoto,
  pickGalleryPhotos,
  unitPhotos = [],
  onDeletePhoto,
  onViewPhoto,
  onUploadPhoto,
  onEditAssetDetails,
  job,
}) => {
  const { t } = useLanguage();
  const { state } = useAppContext();
  const isHvacUnit = isHvacTrade(job || (asset as any)?.job, state.currentOrganization);

  const [notServicedToday, setNotServicedToday] = useState<boolean>(unitState?.notServicedToday || false);
  const [healthBefore, setHealthBefore] = useState<'Good' | 'Fair' | 'Poor' | 'Critical'>(
    unitState?.healthBefore || unitState?.health || 'Good'
  );
  const [healthAfter, setHealthAfter] = useState<'Good' | 'Fair' | 'Poor' | 'Critical'>(
    unitState?.healthAfter || 'Good'
  );
  const [diagnosis, setDiagnosis] = useState(unitState?.diagnosis || '');
  const [repair, setRepair] = useState(unitState?.repair || '');
  const [recommendations, setRecommendations] = useState(unitState?.recommendations || '');

  const [localGpsPin, setLocalGpsPin] = useState<{ lat: number; lng: number } | null>(() => {
    if (asset?.gpsPin && typeof asset.gpsPin.lat === 'number' && typeof asset.gpsPin.lng === 'number') {
      return asset.gpsPin;
    }
    if (typeof asset?.gpsLat === 'number' && typeof asset?.gpsLng === 'number') {
      return { lat: asset.gpsLat, lng: asset.gpsLng };
    }
    return null;
  });
  const [isCapturingUnitGps, setIsCapturingUnitGps] = useState(false);

  const handleCaptureUnitGps = async () => {
    setIsCapturingUnitGps(true);
    try {
      const loc = await getCurrentLocation();
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        const newPin = { lat: loc.lat, lng: loc.lng };
        setLocalGpsPin(newPin);
        if (asset?.id) {
          try {
            await db.collection('equipment').doc(asset.id).set({
              gpsPin: newPin,
              gpsLat: loc.lat,
              gpsLng: loc.lng,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          } catch (e) {
            try {
              await db.collection('assets').doc(asset.id).set({
                gpsPin: newPin,
                gpsLat: loc.lat,
                gpsLng: loc.lng,
                updatedAt: new Date().toISOString(),
              }, { merge: true });
            } catch (err) {
              console.warn("Firestore GPS update fallback:", err);
            }
          }
        }
        showToast.success(t(`Unit GPS Pin updated: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`));
      } else {
        showToast.warn(t("Unable to acquire location fix. Check location permissions."));
      }
    } catch (err: any) {
      console.error("GPS capture error in UnitWorkModal:", err);
      showToast.error(t("GPS acquisition error: ") + (err.message || 'Check location permissions'));
    } finally {
      setIsCapturingUnitGps(false);
    }
  };

  // DUAL PHASE READINGS (Before Repair vs After Repair)
  const [readingPhase, setReadingPhase] = useState<'before' | 'after'>('before');
  const [tempSplitBefore, setTempSplitBefore] = useState(unitState?.tempSplitBefore || unitState?.tempSplit || '');
  const [tempSplitAfter, setTempSplitAfter] = useState(unitState?.tempSplitAfter || '');
  const [electricalReadingsBefore, setElectricalReadingsBefore] = useState(unitState?.electricalReadingsBefore || unitState?.electricalReadings || '');
  const [electricalReadingsAfter, setElectricalReadingsAfter] = useState(unitState?.electricalReadingsAfter || '');
  const [refrigerantReadingsBefore, setRefrigerantReadingsBefore] = useState(unitState?.refrigerantReadingsBefore || unitState?.refrigerantReadings || '');
  const [refrigerantReadingsAfter, setRefrigerantReadingsAfter] = useState(unitState?.refrigerantReadingsAfter || '');

  // SYSTEM SAFETY & OPERATING QUICK CHECKS (Drain, Thermostat, Safeties)
  const [drainStatus, setDrainStatus] = useState<'Pass' | 'Fail' | 'N/A'>(unitState?.drainStatus || 'Pass');
  const [thermostatStatus, setThermostatStatus] = useState<'Pass' | 'Fail' | 'N/A'>(unitState?.thermostatStatus || 'Pass');
  const [safetiesStatus, setSafetiesStatus] = useState<'Pass' | 'Fail' | 'N/A'>(unitState?.safetiesStatus || 'Pass');

  const [lineItems, setLineItems] = useState<UnitLineItem[]>(unitState?.unitLineItems || []);

  // TOOL 1: EPA Refrigerant Log Tool State
  const [refType, setRefType] = useState<string>(unitState?.refrigerantType || asset?.refrigerantType || 'R-410A');
  const [refAction, setRefAction] = useState<'Added' | 'Recovered' | 'Tested'>(unitState?.refrigerantAction || 'Added');
  const [refLbs, setRefLbs] = useState<number>(unitState?.refrigerantLbs || 0);
  const [refOz, setRefOz] = useState<number>(unitState?.refrigerantOz || 0);
  const [cylinderTag, setCylinderTag] = useState<string>(unitState?.cylinderTag || '');
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const unitFileInputRef = React.useRef<HTMLInputElement>(null);
  // Internal HVAC Field Tools Modal State
  const [unitPhotoCategory, setUnitPhotoCategory] = useState<string>('Before');
  const [isHvacToolsOpen, setIsHvacToolsOpen] = useState(false);
  const [hvacToolTab, setHvacToolTab] = useState<'calc' | 'deltaT' | 'epa' | 'vitals'>('calc');
  const [calcRefType, setCalcRefType] = useState('R-410A');
  const [suctionPsi, setSuctionPsi] = useState('');
  const [suctionTemp, setSuctionTemp] = useState('');
  const [liquidPsi, setLiquidPsi] = useState('');
  const [liquidTemp, setLiquidTemp] = useState('');
  const [calcReturnTemp, setCalcReturnTemp] = useState('');
  const [calcSupplyTemp, setCalcSupplyTemp] = useState('');

  const calculateSatTemp = (pressure: number, type: string): number => {
    if (isNaN(pressure) || pressure <= -14.7) return 0;
    const p = pressure + 14.7; // convert PSIG to PSIA
    switch (type) {
      case 'R-410A': return (-226.7 + 63.8 * Math.log(p));
      case 'R-22': return (-239.3 + 69.4 * Math.log(p));
      case 'R-134a': return (-257.6 + 87.2 * Math.log(p));
      case 'R-32': return (-228.5 + 64.2 * Math.log(p));
      case 'R-404A': return (-235.1 + 65.5 * Math.log(p));
      case 'R-407C': return (-242.8 + 68.1 * Math.log(p));
      case 'R-454B': return (-230.1 + 64.5 * Math.log(p));
      default: return (-226.7 + 63.8 * Math.log(p));
    }
  };

  // Comprehensive collection of unit photos from all sources
  const allUnitPhotos = React.useMemo(() => {
    const photoList: StoredFile[] = [...unitPhotos];

    const addPhoto = (url?: string, label?: string) => {
      if (!url) return;
      if (!photoList.some((p) => (p.dataUrl || p.url) === url)) {
        photoList.push({
          id: `unit-photo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: label || `${asset?.name || 'Unit'} Photo`,
          url: url,
          dataUrl: url,
          type: 'image/jpeg',
          size: 0,
          uploadedAt: new Date().toISOString(),
          metadata: { assetId: asset?.id, label: label || 'Unit Photo' }
        });
      }
    };

    addPhoto(asset?.unitTagPhotoUrl || (asset as any)?.unitTagPhotoUrl, `Unit ${asset?.name || ''} Data Plate Tag`);
    addPhoto(asset?.dataPlatePhotoUrl || (asset as any)?.dataPlatePhotoUrl, `Unit ${asset?.name || ''} Data Plate Tag`);
    addPhoto(asset?.photoUrl || (asset as any)?.photoUrl, `Unit ${asset?.name || ''} Photo`);
    addPhoto(unitState?.beforePhotoUrl, `Unit ${asset?.name || ''} (Before Repair)`);
    addPhoto(unitState?.afterPhotoUrl, `Unit ${asset?.name || ''} (After Repair)`);
    addPhoto(unitState?.photoUrl, `Unit ${asset?.name || ''} Photo`);

    if (Array.isArray(unitState?.photos)) {
      unitState.photos.forEach((p: any) => {
        if (typeof p === 'string') {
          addPhoto(p, `Unit ${asset?.name || ''} Photo`);
        } else if (p && (p.url || p.dataUrl)) {
          addPhoto(p.url || p.dataUrl, p.label || p.name || `Unit ${asset?.name || ''} Photo`);
        }
      });
    }

    return photoList;
  }, [unitPhotos, unitState, asset]);

  const processBatchFiles = async (filesArray: File[]) => {
    if (!filesArray || filesArray.length === 0) return;
    const orgId = job?.organizationId || (asset as any)?.organizationId || state.currentOrganization?.id || state.currentUser?.organizationId || 'default';
    showToast.info(t(`Uploading ${filesArray.length} photo(s)...`));

    try {
      const newPhotoObjects: StoredFile[] = [];
      let queuedOfflineCount = 0;

      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_') : `unit_photo_${Date.now()}.jpg`;
        const path = `organizations/${orgId}/assets/${asset?.id || 'general'}/${Date.now()}_${i}_${safeName}`;
        const photoId = `unit-photo-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        
        let fileUrl = '';
        let isOfflineQueued = false;

        if (state.isDemoMode) {
          fileUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        } else {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            isOfflineQueued = true;
          } else {
            try {
              fileUrl = await uploadFileToStorage(path, file);
            } catch (upErr: any) {
              console.warn("[UnitWorkModal] Direct storage upload failed, falling back to local offline staging:", upErr);
              isOfflineQueued = true;
            }
          }

          if (isOfflineQueued) {
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

            if (asset?.id) {
              await offlineSyncManager.registerPendingUpload({
                id: photoId,
                parentCollection: 'equipment',
                parentId: asset.id,
                orgId: orgId,
                storagePath: path,
                dataUrl: fileUrl,
                fileName: file.name || safeName,
                fileType: file.type || 'image/jpeg',
                timestamp: Date.now()
              });
            }
          }
        }

        const isAfterCategory = unitPhotoCategory.toLowerCase() === 'after';
        const newPhotoObj: StoredFile = {
          id: photoId,
          name: file.name || safeName,
          fileName: file.name || safeName,
          url: fileUrl,
          dataUrl: fileUrl,
          type: file.type || 'image/jpeg',
          fileType: file.type || 'image/jpeg',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          category: isAfterCategory ? 'After' : unitPhotoCategory,
          phase: isAfterCategory ? 'after' : 'before',
          label: `${asset?.name || 'Unit'} (${unitPhotoCategory})`,
          ...(asset?.id ? { assetId: asset.id } : {}),
          metadata: {
             label: `${asset?.name || 'Unit'} (${unitPhotoCategory})`,
             category: isAfterCategory ? 'After' : unitPhotoCategory,
             phase: isAfterCategory ? 'after' : 'before',
             ...(asset?.id ? { assetId: asset.id } : {}),
             pendingUpload: isOfflineQueued
          }
        };

        newPhotoObjects.push(newPhotoObj);

        if (onUploadPhoto) {
          onUploadPhoto(file, `${asset?.name || 'Unit'} (${unitPhotoCategory})`, asset?.id);
        }
      }

      const cleanedNewPhotos = cleanUndefinedFields(newPhotoObjects);
      const updatedPhotos = [...(unitState?.photos || []), ...cleanedNewPhotos];
      onSaveUnitState({
        ...unitState,
        assetId: asset?.id,
        photos: updatedPhotos
      });

      if (queuedOfflineCount > 0) {
        showToast.info(t(`${queuedOfflineCount} unit photo(s) saved offline. Will sync when online!`));
      } else {
        showToast.success(t(`${newPhotoObjects.length} photo(s) uploaded as ${unitPhotoCategory} for unit!`));
      }
    } catch (err: any) {
      console.error("Unit photo upload error:", err);
      showToast.error(t("Failed to save unit photos. Please try again."));
    }
  };

  const handleFileUploadInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    await processBatchFiles(Array.from(uploadedFiles));
    e.target.value = '';
  };

  const handlePickUnitGallery = async () => {
    if (pickGalleryPhotos) {
      pickGalleryPhotos(`${asset?.name || 'Unit'} (${unitPhotoCategory})`, asset?.id);
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await CapCamera.pickImages({
          quality: 75,
          limit: 0
        });
        if (result.photos && result.photos.length > 0) {
          const filePromises = result.photos.map(async (photo, idx) => {
            const response = await fetch(photo.webPath);
            const blob = await response.blob();
            return new File([blob], `gallery_${Date.now()}_${idx}.jpg`, { type: 'image/jpeg' });
          });
          const convertedFiles = await Promise.all(filePromises);
          await processBatchFiles(convertedFiles);
        }
      } else {
        unitFileInputRef.current?.click();
      }
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (!msg.includes('cancel') && !msg.includes('dismiss')) {
        console.error("Unit gallery picker error:", err);
        showToast.error("Failed to pick photos: " + (err.message || "Unknown error"));
      }
    }
  };
  const [epaCertNo, setEpaCertNo] = useState<string>('EPA-608-UNIVERSAL-9982');

  // TOOL 2: Target Temp Split Tool State
  const [returnTemp, setReturnTemp] = useState<number | ''>(75);
  const [supplyTemp, setSupplyTemp] = useState<number | ''>(56);
  const [indoorHumidity, setIndoorHumidity] = useState<number | ''>(50);

  // System Tools Import Card State
  const [selectedSystemTool, setSelectedSystemTool] = useState<string | null>(null);

  // On-the-spot repair modal state
  const [isOnTheSpotOpen, setIsOnTheSpotOpen] = useState(false);
  const [onTheSpotDesc, setOnTheSpotDesc] = useState('');
  const [onTheSpotFee, setOnTheSpotFee] = useState<number>(49.00);

  // New Line item form state
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number>(0);
  const [newItemQty, setNewItemQty] = useState<number>(1);

  // Temp Split Math Calculations
  const actualSplit = typeof returnTemp === 'number' && typeof supplyTemp === 'number' ? returnTemp - supplyTemp : 0;
  const targetSplit = typeof indoorHumidity === 'number' ? Math.round(20 - (indoorHumidity - 50) * 0.1) : 19;

  let splitStatus: { label: string; color: string; badgeBg: string } = {
    label: 'Optimal Temp Split',
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300'
  };

  if (actualSplit < 15 && actualSplit > 0) {
    splitStatus = {
      label: 'Low Temp Split (Check Charge / Airflow)',
      color: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300'
    };
  } else if (actualSplit > 23) {
    splitStatus = {
      label: 'High Temp Split (Possible Restricted Airflow)',
      color: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300'
    };
  }

  const handleApplyTempSplit = () => {
    if (!returnTemp || !supplyTemp) {
      showToast.warn(t("Please enter valid Return and Supply temperatures."));
      return;
    }
    const formattedSplit = `${actualSplit}°F (Return: ${returnTemp}°F, Supply: ${supplyTemp}°F, Target: ${targetSplit}°F)`;
    if (readingPhase === 'after') {
      setTempSplitAfter(formattedSplit);
    } else {
      setTempSplitBefore(formattedSplit);
    }
    
    const splitNote = `[Temp Split Diagnostic - ${readingPhase === 'after' ? 'After Repair' : 'Before Repair'}]: Actual split is ${actualSplit}°F vs Target ${targetSplit}°F. Evaluation: ${splitStatus.label}.`;
    setDiagnosis((prev) => (prev ? `${prev}\n${splitNote}` : splitNote));
    showToast.success(t(`Target Temp Split applied to ${readingPhase === 'after' ? 'After Repair' : 'Before Repair'} assessment!`));
  };

  const handleLogEpaRefrigerant = () => {
    if (refLbs === 0 && refOz === 0 && refAction !== 'Tested') {
      showToast.warn(t("Please enter refrigerant weight (lbs/oz)."));
      return;
    }

    const logString = `${refType}: ${refAction} ${refLbs} lbs ${refOz} oz ${cylinderTag ? `(Cyl #${cylinderTag})` : ''} | Tech Cert: ${epaCertNo}`;
    if (readingPhase === 'after') {
      setRefrigerantReadingsAfter(logString);
    } else {
      setRefrigerantReadingsBefore(logString);
    }

    const refNote = `[EPA Refrigerant Log]: ${refAction} ${refLbs} lbs ${refOz} oz of ${refType}. Cylinder Tag: ${cylinderTag || 'N/A'}. Compliance logged.`;
    setRepair((prev) => (prev ? `${prev}\n${refNote}` : refNote));

    if (refAction === 'Added' && onAddInvoiceLineItem && (refLbs > 0 || refOz > 0)) {
      const estPrice = refType.includes('22') ? 250 : refType.includes('454') ? 65 : 45;
      const totalLbs = refLbs + refOz / 16;
      const amount = Math.round(totalLbs * estPrice * 100) / 100;
      onAddInvoiceLineItem({
        name: `Refrigerant ${refType} (${totalLbs.toFixed(1)} lbs)`,
        amount,
        description: `EPA Logged refrigerant charge for unit ${asset.name || asset.id}`
      });
    }

    showToast.success(t("EPA Refrigerant transaction logged to EPA records!"));
  };

  // System Tool Quick Imports
  const handleImportSystemToolData = (toolKey: string) => {
    if (toolKey === 'measureQuick' || toolKey === 'hvacCalc' || toolKey === 'pt_calc') {
      setIsHvacToolsOpen(true);
      setHvacToolTab('calc');
    } else if (toolKey === 'deltaT') {
      setIsHvacToolsOpen(true);
      setHvacToolTab('deltaT');
    } else if (toolKey === 'epa') {
      setIsHvacToolsOpen(true);
      setHvacToolTab('epa');
    } else if (toolKey === 'vacuum' || toolKey === 'electrical') {
      setIsHvacToolsOpen(true);
      setHvacToolTab('vitals');
    } else if (toolKey === 'tuneup') {
      setDiagnosis((prev) => (prev ? `${prev}\n[Tune-Up]: Coils cleaned, 16x25x1 MERV 11 filter replaced, drain line flushed.` : '[Tune-Up]: Coils cleaned, 16x25x1 MERV 11 filter replaced, drain line flushed.'));
      showToast.success(t("Imported HVAC Annual Tune-Up Checklist!"));
    } else if (toolKey === 'materials') {
      setLineItems((prev) => [
        ...prev,
        { id: `li-${Date.now()}`, name: 'R-410A Refrigerant Charge', price: 85, description: 'R-410A Refrigerant Charge', quantity: 2, unitCost: 45, unitPrice: 85, isTaxable: true, category: 'refrigerant' }
      ]);
      showToast.success(t("Added default refrigerant materials item to billing!"));
    }
  };

  const handleSave = async () => {
    setIsSavingUnit(true);
    try {
      // Generate backwards compatible summary text for legacy reports
      const combinedTempSplit = tempSplitAfter ? `Before: ${tempSplitBefore || 'N/A'} | After: ${tempSplitAfter}` : (tempSplitBefore || '');
      const combinedElectrical = electricalReadingsAfter ? `Before: ${electricalReadingsBefore || 'N/A'} | After: ${electricalReadingsAfter}` : (electricalReadingsBefore || '');
      const combinedRefrigerant = refrigerantReadingsAfter ? `Before: ${refrigerantReadingsBefore || 'N/A'} | After: ${refrigerantReadingsAfter}` : (refrigerantReadingsBefore || '');

      await Promise.resolve(onSaveUnitState({
        ...unitState,
        assetId: asset.id,
        photos: allUnitPhotos,
        notServicedToday,
        health: healthAfter || healthBefore,
        healthBefore,
        healthAfter,
        diagnosis,
        repair,
        recommendations,
        // Phase Specific Readings
        tempSplitBefore,
        tempSplitAfter,
        electricalReadingsBefore,
        electricalReadingsAfter,
        refrigerantReadingsBefore,
        refrigerantReadingsAfter,
        // Legacy backwards compatible fields
        tempSplit: combinedTempSplit,
        electricalReadings: combinedElectrical,
        refrigerantReadings: combinedRefrigerant,
        // System Quick Checks
        drainStatus,
        thermostatStatus,
        safetiesStatus,
        // Refrigerant Log & Items
        refrigerantType: refType,
        refrigerantLbs: refLbs,
        refrigerantOz: refOz,
        refrigerantAction: refAction,
        cylinderTag,
        unitLineItems: lineItems,
      }));
      showToast.success(t("Unit inspection saved successfully!"));
    } catch (err: any) {
      console.error("Failed to save unit inspection:", err);
      showToast.error(t("Failed to save unit record: ") + (err?.message || "Unknown error"));
    } finally {
      setIsSavingUnit(false);
      onClose();
    }
  };

  const handlePerformOnTheSpotRepair = () => {
    if (!onTheSpotDesc.trim()) {
      showToast.warn(t("Please describe the on-the-spot repair performed."));
      return;
    }

    const timestamp = new Date().toISOString();
    const newRepairRecord = {
      description: onTheSpotDesc.trim(),
      fee: onTheSpotFee,
      timestamp,
    };

    const updatedOnTheSpot = [...(unitState?.onTheSpotRepairs || []), newRepairRecord];
    const updatedRepairText = repair ? `${repair}\n[On-the-Spot Fix]: ${onTheSpotDesc}` : `[On-the-Spot Fix]: ${onTheSpotDesc}`;

    onSaveUnitState({
      ...unitState,
      assetId: asset.id,
      health: healthAfter === 'Critical' ? 'Good' : healthAfter,
      healthAfter: 'Good',
      repair: updatedRepairText,
      onTheSpotRepairs: updatedOnTheSpot,
    });

    if (onAddInvoiceLineItem && onTheSpotFee > 0) {
      onAddInvoiceLineItem({
        name: `On-the-Spot Repair (${asset.name || asset.id}): ${onTheSpotDesc}`,
        amount: onTheSpotFee,
        description: `Minor correction performed on-site for unit ${asset.name || asset.id}`,
      });
    }

    showToast.success(t("On-the-spot repair logged! Invoice & Tech Credit updated."));
    setIsOnTheSpotOpen(false);
    setOnTheSpotDesc('');
  };

  const handleAddLineItem = () => {
    if (!newItemName.trim()) {
      showToast.warn(t("Please enter repair item name."));
      return;
    }

    const newItem: UnitLineItem = {
      id: `item_${Date.now()}`,
      name: newItemName.trim(),
      description: newItemDesc.trim() || undefined,
      price: newItemPrice,
      quantity: newItemQty,
    };

    const updated = [...lineItems, newItem];
    setLineItems(updated);
    setIsAddItemOpen(false);
    setNewItemName('');
    setNewItemDesc('');
    setNewItemPrice(0);
    setNewItemQty(1);
    showToast.success(t("Repair item added for proposal aggregation!"));
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((i) => i.id !== id));
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Unit Assessment: ${typeof asset.name === 'string' ? asset.name : asset.name ? String(asset.name) : typeof asset.id === 'string' ? asset.id : 'Unit'}`}
        size="lg"
      >
        <div className="space-y-6 max-h-[82vh] overflow-y-auto custom-scrollbar p-1 text-slate-800 dark:text-slate-200">
          {/* Asset Info Header Strip */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Cpu className="text-primary-600" size={20} />
                {asset.name || asset.title || (asset.model ? `${asset.brand || ''} ${asset.model}`.trim() : `${asset.brand || ''} ${asset.type || 'Equipment Unit'}`.trim())}
              </h4>
              <p className="text-xs text-slate-500 font-mono">
                {asset.brand || 'Serviced Equipment'} • Model: {asset.model || asset.modelNumber || 'N/A'} • S/N: {asset.serial || asset.serialNumber || 'N/A'}
              </p>
              {(() => {
                const pin = localGpsPin || asset.gpsPin;
                const lat = (pin && typeof pin.lat === 'number') ? pin.lat : (typeof asset.gpsLat === 'number' ? asset.gpsLat : undefined);
                const lng = (pin && typeof pin.lng === 'number') ? pin.lng : (typeof asset.gpsLng === 'number' ? asset.gpsLng : undefined);
                if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
                  return (
                    <a
                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline pt-0.5"
                      title={t("Open coordinates in Google Maps")}
                    >
                      <Compass size={12} className="text-blue-500 shrink-0" />
                      <span>GPS: {lat.toFixed(6)}, {lng.toFixed(6)}</span>
                      <ExternalLink size={10} className="opacity-70" />
                    </a>
                  );
                }
                return null;
              })()}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCaptureUnitGps}
                disabled={isCapturingUnitGps}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title={t("Acquire device GPS coordinates and save to unit")}
              >
                <Compass size={13} className={isCapturingUnitGps ? "animate-spin text-blue-600" : "text-blue-500"} />
                <span>{isCapturingUnitGps ? t("Locating...") : t("📍 Pin GPS")}</span>
              </button>

              {onEditAssetDetails && (
                <button
                  type="button"
                  onClick={() => onEditAssetDetails(asset)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <Pencil size={13} />
                  <span>{t("Edit Details")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Toggle: Not Serviced Today */}
          <div className={`p-4 rounded-xl border transition-all ${
            notServicedToday 
              ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 shadow-xs' 
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
          }`}>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base transition-colors ${
                  notServicedToday ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  🚫
                </div>
                <div>
                  <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    {t("Not Serviced Today")}
                    {notServicedToday && (
                      <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-extrabold px-2 py-0.5 rounded-md">
                        {t("Excluded from Report")}
                      </span>
                    )}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {t("Check this to exclude this unit from today's customer visit report while preserving past equipment history.")}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notServicedToday}
                onChange={(e) => setNotServicedToday(e.target.checked)}
                className="w-5 h-5 accent-amber-600 rounded cursor-pointer shrink-0"
              />
            </label>
          </div>

          {/* Prominent Unit Health Assessment Section with Color Border */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-3 ${
            healthAfter === 'Critical' || healthBefore === 'Critical' ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 shadow-md shadow-rose-500/10' :
            healthAfter === 'Poor' || healthBefore === 'Poor' ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/30 shadow-md shadow-orange-500/10' :
            healthAfter === 'Fair' || healthBefore === 'Fair' ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 shadow-md shadow-amber-500/10' :
            'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-md shadow-emerald-500/10'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity size={18} className="text-primary-600 animate-pulse" />
                  {t("Unit Health & Condition Assessment")}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("Record initial diagnostic condition before repairs and post-repair verified health.")}
                </p>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border text-slate-700 dark:text-slate-300 shadow-xs">
                ⚠️ {t("Required Update")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* 1. Diagnostic Initial Condition */}
              <div className="space-y-1.5 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("1. Diagnostic Initial Condition")}
                </label>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(['Good', 'Fair', 'Poor', 'Critical'] as const).map((h) => {
                    const isSel = healthBefore === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHealthBefore(h)}
                        className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all border ${
                          isSel
                            ? h === 'Critical' ? 'bg-rose-600 text-white border-rose-700'
                            : h === 'Poor' ? 'bg-orange-500 text-white border-orange-600'
                            : h === 'Fair' ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Post-Repair Verified Health */}
              <div className="space-y-1.5 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  {t("2. Post-Repair Verified Health")}
                </label>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(['Good', 'Fair', 'Poor', 'Critical'] as const).map((h) => {
                    const isSel = healthAfter === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHealthAfter(h)}
                        className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all border ${
                          isSel
                            ? h === 'Critical' ? 'bg-rose-600 text-white border-rose-700'
                            : h === 'Poor' ? 'bg-orange-500 text-white border-orange-600'
                            : h === 'Fair' ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row: Quick Repair & Add Line Item */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={() => setIsOnTheSpotOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 flex items-center justify-center gap-2 text-xs shadow-md"
            >
              <Zap size={18} />
              {t("⚡ Perform On-the-Spot Repair")}
            </Button>
            <Button
              type="button"
              onClick={() => setIsAddItemOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-11 flex items-center justify-center gap-2 text-xs shadow-md"
            >
              <Plus size={18} />
              {t("+ Add Proposal Repair Line Item")}
            </Button>
          </div>

          {/* ========================================================================= */}
          {/* REQUIRED TOOL 1: EPA REFRIGERANT LOG TOOL CARD                             */}
          {/* ========================================================================= */}
          <div className="p-4 bg-gradient-to-r from-emerald-950/20 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-xl space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileCheck size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    EPA Refrigerant Log Tool
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      EPA 608 Verified
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">Record refrigerant additions, recoveries, and cylinder tracking per EPA guidelines.</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={handleLogEpaRefrigerant}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-lg"
              >
                <CheckCircle size={14} /> Log to EPA Records
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Refrigerant Type</label>
                <select
                  value={refType}
                  onChange={(e) => setRefType(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-bold focus:border-emerald-500"
                >
                  <option value="R-410A">R-410A</option>
                  <option value="R-22">R-22 (Reclaimed)</option>
                  <option value="R-454B">R-454B (Opteon XL20)</option>
                  <option value="R-32">R-32</option>
                  <option value="R-134a">R-134a</option>
                  <option value="R-404A">R-404A</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Action Performed</label>
                <select
                  value={refAction}
                  onChange={(e) => setRefAction(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-bold focus:border-emerald-500"
                >
                  <option value="Added">Charged / Added</option>
                  <option value="Recovered">Recovered / Reclaimed</option>
                  <option value="Tested">Pressure & Leak Tested</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Weight (Lbs / Oz)</label>
                <div className="flex gap-1">
                  <NumberInput
                    min="0"
                    placeholder="Lbs"
                    value={refLbs || ''}
                    onChange={(e) => setRefLbs(parseFloat(e.target.value) || 0)}
                    className="w-1/2 bg-white dark:bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold"
                  />
                  <NumberInput
                    min="0"
                    max="15"
                    placeholder="Oz"
                    value={refOz || ''}
                    onChange={(e) => setRefOz(parseFloat(e.target.value) || 0)}
                    className="w-1/2 bg-white dark:bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Cylinder Tag / ID</label>
                <input
                  type="text"
                  placeholder="e.g. CYL-410-09"
                  value={cylinderTag}
                  onChange={(e) => setCylinderTag(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* REQUIRED TOOL 2: TARGET TEMP SPLIT CALCULATOR TOOL CARD                   */}
          {/* ========================================================================= */}
          <div className="p-4 bg-gradient-to-r from-sky-950/20 via-slate-900 to-slate-900 border border-sky-500/40 rounded-xl space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/20 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Thermometer size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    Target Temp Split Tool
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${splitStatus.badgeBg}`}>
                      {splitStatus.label}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">Calculate Delta T, evaluate airflow, and log thermal efficiency split.</p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleApplyTempSplit}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-lg"
              >
                <Sliders size={14} /> Apply Temp Split
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Return Air Temp (°F)</label>
                <input
                  type="number"
                  placeholder="e.g. 75"
                  value={returnTemp}
                  onChange={(e) => setReturnTemp(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Supply Air Temp (°F)</label>
                <input
                  type="number"
                  placeholder="e.g. 56"
                  value={supplyTemp}
                  onChange={(e) => setSupplyTemp(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Indoor RH (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={indoorHumidity}
                  onChange={(e) => setIndoorHumidity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Delta T Split</span>
                <span className="text-sm font-extrabold text-sky-400 font-mono">
                  {actualSplit}°F <span className="text-[10px] text-slate-500 font-normal">(Target: {targetSplit}°F)</span>
                </span>
              </div>
            </div>

            {/* Smart Manufacturer Target Specs & Auto Tech Recommendation Engine */}
            <div className="p-3.5 bg-sky-50/90 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[11px] text-sky-900 dark:text-sky-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={15} className="text-sky-600" />
                  {t("Optimal Manufacturer Target Specifications")}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100 rounded-full font-mono">
                  {t("AHRI Spec Targets")}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-sky-100 dark:border-sky-900">
                  <span className="text-[10px] text-slate-400 block font-sans font-bold">{t("Target Delta-T:")}</span>
                  <span className="font-bold text-sky-700 dark:text-sky-300">16.0°F – 22.0°F</span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-sky-100 dark:border-sky-900">
                  <span className="text-[10px] text-slate-400 block font-sans font-bold">{t("R-410A Suction / Liquid:")}</span>
                  <span className="font-bold text-sky-700 dark:text-sky-300">110-130 / 320-400 PSI</span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-sky-100 dark:border-sky-900">
                  <span className="text-[10px] text-slate-400 block font-sans font-bold">{t("Subcooling / Superheat:")}</span>
                  <span className="font-bold text-sky-700 dark:text-sky-300">10-14°F / 8-15°F</span>
                </div>
              </div>

              {/* Dynamic Auto-Recommendation Banner based on Actual Readings */}
              {actualSplit > 0 && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  actualSplit >= 16 && actualSplit <= 22
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : actualSplit < 16
                    ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200'
                }`}>
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">
                      {actualSplit >= 16 && actualSplit <= 22 
                        ? t("✓ Delta-T Operating Within Optimal Specification") 
                        : actualSplit < 16 
                        ? t("⚠️ Tech Recommendation (Low Delta-T < 15°F):") 
                        : t("⚠️ Tech Recommendation (High Delta-T > 23°F):")}
                    </strong>
                    <p className="mt-0.5 text-[11px] leading-relaxed">
                      {actualSplit >= 16 && actualSplit <= 22 
                        ? t("Heat exchange and indoor airflow are balanced according to manufacturer specifications.")
                        : actualSplit < 16 
                        ? t("Inadequate heat absorption. Inspect for undercharged refrigerant, liquid line filter drier restriction, stuck TXV metering valve, or return air bypass.")
                        : t("Airflow restriction across evaporator coil. Inspect dirty air filter, ductwork collapse, closed dampers, dirty coil fins, or low blower motor speed.")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Unit Diagnosis Input */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                  🔒 VISIBILITY: CUSTOMER / INVOICE
                </span>
                <label className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">{t("Unit Diagnosis & Issues Found")}</label>
              </div>
              <VoiceInput onResult={(text) => setDiagnosis(diagnosis ? diagnosis + ' ' + text : text)} />
            </div>
            <Textarea
              rows={3}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder={t("Describe diagnosis and issues specific to this unit...")}
            />
          </div>

          {/* Unit Repairs & Work Done */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">{t("Work / Repairs Performed")}</label>
              <VoiceInput onResult={(text) => setRepair(repair ? repair + ' ' + text : text)} />
            </div>
            <Textarea
              rows={2}
              value={repair}
              onChange={(e) => setRepair(e.target.value)}
              placeholder={t("Describe corrections or service performed on this unit...")}
            />
          </div>

          {/* System Safety & Operating Quick Checks (Drain, Thermostat, Safeties) */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              {t("System Safety & Operating Quick Checks")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Drain Check */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Drain Line & Pan</span>
                <div className="flex gap-1">
                  {(['Pass', 'Fail', 'N/A'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDrainStatus(st)}
                      className={`flex-1 py-1 text-xs font-black uppercase rounded-lg border transition-all ${
                        drainStatus === st
                          ? st === 'Pass'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : st === 'Fail'
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                            : 'bg-slate-600 text-white border-slate-700 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thermostat Check */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Thermostat & Controls</span>
                <div className="flex gap-1">
                  {(['Pass', 'Fail', 'N/A'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setThermostatStatus(st)}
                      className={`flex-1 py-1 text-xs font-black uppercase rounded-lg border transition-all ${
                        thermostatStatus === st
                          ? st === 'Pass'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : st === 'Fail'
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                            : 'bg-slate-600 text-white border-slate-700 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Safeties Check */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">System Safeties & Float</span>
                <div className="flex gap-1">
                  {(['Pass', 'Fail', 'N/A'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSafetiesStatus(st)}
                      className={`flex-1 py-1 text-xs font-black uppercase rounded-lg border transition-all ${
                        safetiesStatus === st
                          ? st === 'Pass'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                            : st === 'Fail'
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                            : 'bg-slate-600 text-white border-slate-700 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Unit Operating Readings with Before Repair vs After Repair Toggle */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Wrench size={16} className="text-primary-600" />
                {t("Unit Operating Readings")}
              </h4>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setReadingPhase('before')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    readingPhase === 'before'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>🛠️</span> {t("Before Repair (Diagnostic)")}
                </button>
                <button
                  type="button"
                  onClick={() => setReadingPhase('after')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    readingPhase === 'after'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>✨</span> {t("After Repair (Verification)")}
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${isHvacUnit ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-3`}>
              {isHvacUnit && (
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    {t("Temp Split (°F)")} ({readingPhase === 'after' ? 'After Repair' : 'Before Repair'})
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 18°F split"
                    value={readingPhase === 'after' ? tempSplitAfter : tempSplitBefore}
                    onChange={(e) => readingPhase === 'after' ? setTempSplitAfter(e.target.value) : setTempSplitBefore(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                  {isHvacUnit ? `${t("Volts / Amps")} (${readingPhase === 'after' ? 'After Repair' : 'Before Repair'})` : `${t("Tool / Equipment Diagnostic Readings")} (${readingPhase === 'after' ? 'After Repair' : 'Before Repair'})`}
                </label>
                <input
                  type="text"
                  placeholder={isHvacUnit ? "e.g. 235V / 13.8A" : "e.g. 120V / 12A, 1.2 Ohms, Torque/Pressure verified"}
                  value={readingPhase === 'after' ? electricalReadingsAfter : electricalReadingsBefore}
                  onChange={(e) => readingPhase === 'after' ? setElectricalReadingsAfter(e.target.value) : setElectricalReadingsBefore(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs font-mono font-bold"
                />
              </div>
              {isHvacUnit && (
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    {t("Pressures (PSI)")} ({readingPhase === 'after' ? 'After Repair' : 'Before Repair'})
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 120 / 340 psi"
                    value={readingPhase === 'after' ? refrigerantReadingsAfter : refrigerantReadingsBefore}
                    onChange={(e) => readingPhase === 'after' ? setRefrigerantReadingsAfter(e.target.value) : setRefrigerantReadingsBefore(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              )}
            </div>

            {/* Side-by-Side Comparison Table if both phases have readings */}
            {(tempSplitBefore || electricalReadingsBefore || refrigerantReadingsBefore || tempSplitAfter || electricalReadingsAfter || refrigerantReadingsAfter) && (
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <span className="font-extrabold text-[10px] uppercase text-slate-400 tracking-wider block">
                  Diagnostic Comparison: Before vs. After Repair
                </span>
                <div className="grid grid-cols-3 font-extrabold text-[10px] uppercase border-b border-slate-200 dark:border-slate-800 pb-1.5">
                  <span className="text-slate-400">Metric</span>
                  <span className="text-amber-600 dark:text-amber-400">🛠️ Before Repair</span>
                  <span className="text-emerald-600 dark:text-emerald-400">✨ After Repair</span>
                </div>
                {isHvacUnit && (
                  <div className="grid grid-cols-3 font-mono text-[11px]">
                    <span className="font-sans font-bold text-slate-600 dark:text-slate-300">Temp Split:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{tempSplitBefore || '—'}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{tempSplitAfter || '—'}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 font-mono text-[11px]">
                  <span className="font-sans font-bold text-slate-600 dark:text-slate-300">{isHvacUnit ? 'Volts / Amps:' : 'Tool Readings:'}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{electricalReadingsBefore || '—'}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{electricalReadingsAfter || '—'}</span>
                </div>
                {isHvacUnit && (
                  <div className="grid grid-cols-3 font-mono text-[11px]">
                    <span className="font-sans font-bold text-slate-600 dark:text-slate-300">Pressures (PSI):</span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">{refrigerantReadingsBefore || '—'}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{refrigerantReadingsAfter || '—'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Unit Photos */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Camera size={16} className="text-primary-600" />
                {t("Unit Photos & Data Plate")} ({allUnitPhotos.length})
              </h4>
              
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={unitPhotoCategory}
                  onChange={(e) => setUnitPhotoCategory(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="Before">🏷️ Tag: Before</option>
                  <option value="After">🏷️ Tag: After</option>
                  <option value="Data Plate">🏷️ Tag: Data Plate</option>
                  <option value="Defect">🏷️ Tag: Defect</option>
                  <option value="General">🏷️ Tag: General</option>
                </select>

                {takeNativePhoto && (
                  <Button variant="secondary" size="sm" onClick={() => takeNativePhoto(`${asset.name || 'Unit'} (${unitPhotoCategory})`, asset?.id)} className="text-xs flex items-center gap-1">
                    <Camera size={14} /> {t("Take Photo")}
                  </Button>
                )}

                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={handlePickUnitGallery} 
                  className="text-xs flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                >
                  <ImageIcon size={14} /> {t("Gallery")}
                </Button>

                {/* Upload Photo Button */}
                <label className="bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-all shadow-sm">
                  <Upload size={14} />
                  <span>{t("Upload Photo")}</span>
                  <input
                    ref={unitFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUploadInput}
                  />
                </label>
              </div>
            </div>

            {allUnitPhotos.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto py-2 custom-scrollbar">
                {allUnitPhotos.map((photo, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 border group">
                    <img
                      src={photo.dataUrl || photo.url}
                      alt={photo.label || 'Unit'}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => onViewPhoto && onViewPhoto(photo)}
                    />
                    {onDeletePhoto && (
                      <button
                        onClick={() => onDeletePhoto(photo)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition-colors"
                        title={t("Delete Photo")}
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-2">{t("No photos attached for this specific unit yet.")}</p>
            )}
          </div>

          {/* Unit Proposal Line Items List */}
          {lineItems.length > 0 && (
            <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-xl space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-purple-900 dark:text-purple-300">
                {t("Recommended Repairs (Will Import to Job Proposal)")}
              </h4>
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-lg border text-xs">
                    <div>
                      <strong className="block font-bold">{item.name}</strong>
                      {item.description && <p className="text-[11px] text-slate-500 italic mt-0.5">{item.description}</p>}
                      <span className="text-slate-500 text-[11px]">Qty: {item.quantity} × ${item.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-purple-700 dark:text-purple-300">${(item.quantity * item.price).toFixed(2)}</span>
                      <button type="button" onClick={() => handleRemoveLineItem(item.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* BOTTOM CARD: SYSTEM TOOLS TO IMPORT READINGS AS NEEDED                     */}
          {/* ========================================================================= */}
          <div className="p-5 bg-gradient-to-br from-slate-900 via-purple-950/30 to-slate-950 border border-purple-500/40 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Database size={20} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                    System Tools to Import Readings
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Telemetry & Custom Tools Dock
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">Import diagnostic readings from active system tools directly into this unit assessment.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                {
                  key: 'hvacCalc',
                  title: 'HVAC P/T & Superheat Calculator',
                  desc: 'Calculate Sat Temps, Superheat & Subcooling',
                  icon: Calculator,
                  color: 'text-sky-400 border-sky-500/30 hover:border-sky-400 bg-sky-950/20'
                },
                {
                  key: 'deltaT',
                  title: 'Airflow & Temp Split (Delta T)',
                  desc: 'Target vs actual Delta T airflow evaluation',
                  icon: Thermometer,
                  color: 'text-amber-400 border-amber-500/30 hover:border-amber-400 bg-amber-950/20'
                },
                {
                  key: 'electrical',
                  title: 'Electrical & Motor Diagnostics',
                  desc: 'Compressor RLA/LRA, voltage & cap MFD',
                  icon: Zap,
                  color: 'text-emerald-400 border-emerald-500/30 hover:border-emerald-400 bg-emerald-950/20'
                },
                {
                  key: 'epa',
                  title: 'EPA 608 Refrigerant Log',
                  desc: 'Log refrigerant recovered, charged & cylinder #',
                  icon: Flame,
                  color: 'text-purple-400 border-purple-500/30 hover:border-purple-400 bg-purple-950/20'
                },
                {
                  key: 'tuneup',
                  title: 'HVAC Tune-Up Checklist',
                  desc: 'Import filter replacement & coil cleaning logs',
                  icon: CheckCircle,
                  color: 'text-pink-400 border-pink-500/30 hover:border-pink-400 bg-pink-950/20'
                }
              ].map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <button
                    key={tool.key}
                    type="button"
                    onClick={() => handleImportSystemToolData(tool.key)}
                    className={`p-3 rounded-xl border text-left transition-all group flex flex-col justify-between ${tool.color}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <IconComponent size={16} />
                      <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                        {tool.title}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">{tool.desc}</p>
                    <div className="mt-2 text-[10px] font-bold text-slate-300 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>Open Field Tool</span> →
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={isSavingUnit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 px-6"
            >
              {isSavingUnit ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              {isSavingUnit ? t("Saving Unit Record...") : t("Save Unit Record")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* On-the-Spot Repair Quick Modal */}
      {isOnTheSpotOpen && (
        <Modal isOpen={isOnTheSpotOpen} onClose={() => setIsOnTheSpotOpen(false)} title={t("⚡ Log On-the-Spot Minor Fix")} size="sm">
          <div className="space-y-4 text-slate-800 dark:text-slate-200">
            <p className="text-xs text-slate-500">
              {t("Log quick corrections performed on the spot. This credits your labor performance and adds a line item to the customer invoice.")}
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Correction Performed")}</label>
              <Textarea
                rows={2}
                value={onTheSpotDesc}
                onChange={(e) => setOnTheSpotDesc(e.target.value)}
                placeholder={t("e.g. Cleared drain line cap, tightened 24V loose wire nut...")}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("On-the-Spot Fee ($)")}</label>
              <div className="flex gap-2 mb-2">
                {[0, 49, 75, 120].map((fee) => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => setOnTheSpotFee(fee)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${
                      onTheSpotFee === fee ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    ${fee}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                step="0.01"
                value={onTheSpotFee}
                onChange={(e) => setOnTheSpotFee(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="secondary" onClick={() => setIsOnTheSpotOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button type="button" onClick={handlePerformOnTheSpotRepair} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                {t("Log Fix & Add to Bill")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Proposal Line Item Quick Modal */}
      {isAddItemOpen && (
        <Modal isOpen={isAddItemOpen} onClose={() => setIsAddItemOpen(false)} title={t("Add Unit Repair Line Item")} size="sm">
          <div className="space-y-4 text-slate-800 dark:text-slate-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Repair / Part Name")}</label>
              <Input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={t("e.g. Dual Run Capacitor 45/5 MFD")}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Description")}</label>
              <Textarea
                rows={2}
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                placeholder={t("Enter item description or repair scope...")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Est. Price ($)")}</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t("Quantity")}</label>
                <Input
                  type="number"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="secondary" onClick={() => setIsAddItemOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button type="button" onClick={handleAddLineItem} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                {t("Add to Unit Proposal")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* INTERNAL HVAC DIAGNOSTIC & FIELD TOOLS MODAL */}
      {isHvacToolsOpen && (
        <Modal
          isOpen={isHvacToolsOpen}
          onClose={() => setIsHvacToolsOpen(false)}
          title={
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Calculator className="text-amber-500 shrink-0" size={22} />
              <div>
                <h2 className="font-extrabold text-base md:text-lg">{t("TekAir Internal HVAC Field Tools")}</h2>
                <p className="text-xs text-slate-500 font-normal">{t("Real-time P/T saturation curves, Superheat/Subcooling, and Delta T airflow tools.")}</p>
              </div>
            </div>
          }
          size="lg"
        >
          <div className="space-y-5 py-2">
            {/* Tool Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setHvacToolTab('calc')}
                className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
                  hvacToolTab === 'calc'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calculator size={14} />
                <span>{t("P/T & Superheat/Subcooling")}</span>
              </button>
              <button
                type="button"
                onClick={() => setHvacToolTab('deltaT')}
                className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
                  hvacToolTab === 'deltaT'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Thermometer size={14} />
                <span>{t("Target Temp Split (Delta T)")}</span>
              </button>
              <button
                type="button"
                onClick={() => setHvacToolTab('epa')}
                className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${
                  hvacToolTab === 'epa'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Flame size={14} />
                <span>{t("EPA 608 Log")}</span>
              </button>
            </div>

            {/* TAB 1: P/T & Superheat/Subcooling */}
            {hvacToolTab === 'calc' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Select Refrigerant")}</label>
                  <select
                    value={calcRefType}
                    onChange={(e) => setCalcRefType(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="R-410A">R-410A (Puron)</option>
                    <option value="R-22">R-22 (Freon)</option>
                    <option value="R-454B">R-454B (Opteon XL41)</option>
                    <option value="R-32">R-32</option>
                    <option value="R-134a">R-134a</option>
                    <option value="R-407C">R-407C</option>
                    <option value="R-404A">R-404A</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Suction Side */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                    <span className="text-[10px] font-extrabold uppercase text-sky-600 dark:text-sky-400 tracking-wider block">Low Side (Suction / Evaporator)</span>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t("Suction Pressure (PSIG)")}</label>
                      <input
                        type="number"
                        placeholder="118.0"
                        value={suctionPsi}
                        onChange={(e) => setSuctionPsi(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t("Suction Line Temp (°F)")}</label>
                      <input
                        type="number"
                        placeholder="52.0"
                        value={suctionTemp}
                        onChange={(e) => setSuctionTemp(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs font-bold"
                      />
                    </div>
                    {suctionPsi !== '' && (
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-xs font-bold flex justify-between text-slate-700 dark:text-slate-300">
                        <span>{t("Sat Temp:")} {(calculateSatTemp(parseFloat(suctionPsi), calcRefType)).toFixed(1)}°F</span>
                        {suctionTemp !== '' && (
                          <span className="text-sky-600 dark:text-sky-400">
                            {t("Superheat:")} {(parseFloat(suctionTemp) - calculateSatTemp(parseFloat(suctionPsi), calcRefType)).toFixed(1)}°F
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Liquid Side */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                    <span className="text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400 tracking-wider block">High Side (Liquid / Condenser)</span>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t("Liquid Pressure (PSIG)")}</label>
                      <input
                        type="number"
                        placeholder="342.0"
                        value={liquidPsi}
                        onChange={(e) => setLiquidPsi(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">{t("Liquid Line Temp (°F)")}</label>
                      <input
                        type="number"
                        placeholder="95.0"
                        value={liquidTemp}
                        onChange={(e) => setLiquidTemp(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs font-bold"
                      />
                    </div>
                    {liquidPsi !== '' && (
                      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-xs font-bold flex justify-between text-slate-700 dark:text-slate-300">
                        <span>{t("Sat Temp:")} {(calculateSatTemp(parseFloat(liquidPsi), calcRefType)).toFixed(1)}°F</span>
                        {liquidTemp !== '' && (
                          <span className="text-rose-600 dark:text-rose-400">
                            {t("Subcooling:")} {(calculateSatTemp(parseFloat(liquidPsi), calcRefType) - parseFloat(liquidTemp)).toFixed(1)}°F
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const sh = (suctionPsi && suctionTemp) ? (parseFloat(suctionTemp) - calculateSatTemp(parseFloat(suctionPsi), calcRefType)).toFixed(1) : null;
                      const sc = (liquidPsi && liquidTemp) ? (calculateSatTemp(parseFloat(liquidPsi), calcRefType) - parseFloat(liquidTemp)).toFixed(1) : null;
                      const formatted = `${calcRefType} P/T: Suction ${suctionPsi || '-'} PSI, Liquid ${liquidPsi || '-'} PSI` +
                        (sh ? `, Superheat ${sh}°F` : '') + (sc ? `, Subcooling ${sc}°F` : '');
                      
                      if (readingPhase === 'after') {
                        setRefrigerantReadingsAfter(formatted);
                      } else {
                        setRefrigerantReadingsBefore(formatted);
                      }
                      showToast.success(t(`Applied calculated P/T readings to ${readingPhase === 'after' ? 'After Repair' : 'Before Repair'} phase!`));
                      setIsHvacToolsOpen(false);
                    }}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-xl"
                  >
                    {t("Apply Calculated Readings to Assessment")}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: Temp Split (Delta T) */}
            {hvacToolTab === 'deltaT' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Return Air Temp (°F)")}</label>
                    <input
                      type="number"
                      placeholder="75.0"
                      value={calcReturnTemp}
                      onChange={(e) => setCalcReturnTemp(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Supply Air Temp (°F)")}</label>
                    <input
                      type="number"
                      placeholder="56.0"
                      value={calcSupplyTemp}
                      onChange={(e) => setCalcSupplyTemp(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                {calcReturnTemp !== '' && calcSupplyTemp !== '' && (
                  <div className="p-4 rounded-2xl border bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider block">{t("Calculated Delta T")}</span>
                      <span className="text-2xl font-black">{(parseFloat(calcReturnTemp) - parseFloat(calcSupplyTemp)).toFixed(1)}°F</span>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-white dark:bg-slate-900 shadow-xs">
                      {(parseFloat(calcReturnTemp) - parseFloat(calcSupplyTemp)) >= 16 && (parseFloat(calcReturnTemp) - parseFloat(calcSupplyTemp)) <= 22 ? t("✓ Optimal Airflow Split") : t("⚠️ Check Airflow / Charge")}
                    </span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const delta = (parseFloat(calcReturnTemp) - parseFloat(calcSupplyTemp)).toFixed(1);
                      if (readingPhase === 'after') {
                        setTempSplitAfter(`${delta}°F (Return ${calcReturnTemp}°F / Supply ${calcSupplyTemp}°F)`);
                      } else {
                        setTempSplitBefore(`${delta}°F (Return ${calcReturnTemp}°F / Supply ${calcSupplyTemp}°F)`);
                      }
                      showToast.success(t("Applied Delta T to assessment!"));
                      setIsHvacToolsOpen(false);
                    }}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-xl"
                  >
                    {t("Apply Temp Split to Assessment")}
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 3: EPA Section 608 Recovery Log */}
            {hvacToolTab === 'epa' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs">
                  <span className="font-bold block mb-0.5">{t("EPA Section 608 Compliance Log")}</span>
                  {t("Log refrigerant recovery, virgin refrigerant charge additions, and recovery cylinder serial numbers.")}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Refrigerant Type")}</label>
                    <select
                      value={refType}
                      onChange={(e) => setRefType(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                    >
                      <option value="R-410A">R-410A</option>
                      <option value="R-22">R-22</option>
                      <option value="R-454B">R-454B</option>
                      <option value="R-32">R-32</option>
                      <option value="R-134a">R-134a</option>
                      <option value="R-407C">R-407C</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Recovery Cylinder Serial #")}</label>
                    <input
                      type="text"
                      placeholder="e.g. CYL-998231"
                      value={cylinderTag}
                      onChange={(e) => setCylinderTag(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Refrigerant Added (Lbs)")}</label>
                    <NumberInput
                      step="0.1"
                      value={refLbs}
                      onChange={(e) => setRefLbs(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t("Refrigerant Added (Oz)")}</label>
                    <NumberInput
                      step="0.1"
                      value={refOz}
                      onChange={(e) => setRefOz(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      handleLogEpaRefrigerant();
                      setIsHvacToolsOpen(false);
                    }}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-xl"
                  >
                    {t("Save EPA Refrigerant Entry")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default UnitWorkModal;
