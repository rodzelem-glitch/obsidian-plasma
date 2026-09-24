import React, { useState, useEffect, useRef } from 'react';
import type { Job } from '../../types/job';
import { isHvacTrade, resolveJobTrade } from '../../utils/tradeResolver';
import { Wrench, MapPin, FileText, Camera, Upload, Trash2, DollarSign, ExternalLink, ShieldCheck, AlertCircle, PenTool, CheckCircle2, FileCheck, Store, UserCheck, ImageIcon } from 'lucide-react';
import SignaturePad from '../ui/SignaturePad';
import { safeFormatDateString, safeFormatTimeString } from '../../lib/utils';

export interface PhotoAttachmentItem {
  file: File;
  previewUrl: string;
  category: 'Before' | 'After' | 'Data Plate' | 'Repair' | 'Custom';
  customLabel: string;
}

export interface SubcontractorFormData {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  serviceAddress?: string;
  workOrderNo?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  visitType?: string;
  unitLocation?: string;
  brand?: string;
  modelNo?: string;
  serialNo?: string;
  healthStatus?: string;
  highPressure?: string;
  lowPressure?: string;
  liquidTemp?: string;
  suctionTemp?: string;
  superheat?: string;
  subcooling?: string;
  ambientTemp?: string;
  supplyTemp?: string;
  returnTemp?: string;
  deltaT?: string;
  voltage?: string;
  amps?: string;
  refrigerantType?: string;
  refrigerantLbs?: string;
  refrigerantOz?: string;
  diagnosisNotes?: string;
  workNotes?: string;
  techRecommendations?: string;
  parts?: Array<{ desc: string; sku: string; qty: string; cost: string }>;
  techSignature?: string;
  techName?: string;
  customerSignature?: string;
  managerName?: string;
  storeStamp?: string;
  photoAttachments?: PhotoAttachmentItem[];
  photos?: File[];
}

interface PrintableTechJobFormProps {
  job?: Job | null;
  organization?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: any;
    logoUrl?: string;
  } | any | null;
  copiesCount?: number;
  interactive?: boolean;
  onChangeData?: (data: SubcontractorFormData) => void;
}

export const PrintableTechJobForm: React.FC<PrintableTechJobFormProps> = ({
  job = null,
  organization = null,
  copiesCount = 1,
  interactive = true,
  onChangeData
}) => {
  const copies = Array.from({ length: Math.max(1, copiesCount) });

  const orgName = organization?.name || 'TEKAIR INC.';
  const orgPhone = organization?.phone || '2103184197';
  const orgEmail = organization?.email || 'Operations@tekairinc.com';
  const logo = organization?.logoUrl || organization?.logo || organization?.letterheadDataUrl;

  // Fillable state (default to empty strings for blank printable sheets)
  const [customerName, setCustomerName] = useState(job?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(job?.customerPhone || '');
  const [customerEmail, setCustomerEmail] = useState(job?.customerEmail || '');
  const [serviceAddress, setServiceAddress] = useState(
    typeof job?.address === 'string'
      ? job.address
      : (job?.address ? `${job.address.street || ''}, ${job.address.city || ''} ${job.address.state || ''}` : '')
  );
  const [workOrderNo, setWorkOrderNo] = useState(job?.workOrderNumber || job?.poNumber || job?.id || '');
  const [appointmentDate, setAppointmentDate] = useState(safeFormatDateString(job?.appointmentTime));
  const [appointmentTime, setAppointmentTime] = useState(safeFormatTimeString(job?.appointmentTime, { hour: '2-digit', minute: '2-digit' }));
  const [visitType, setVisitType] = useState<string>(job?.visitType || '');

  // Equipment state
  const firstUnit = Array.isArray(job?.unitStates) ? job?.unitStates?.[0] : null;
  const [unitLocation, setUnitLocation] = useState(firstUnit?.assetId || '');
  const [brand, setBrand] = useState(job?.hvacBrand || '');
  const [modelNo, setModelNo] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [healthStatus, setHealthStatus] = useState<string>(firstUnit?.health || '');

  // Gauge & electrical readings
  const [highPressure, setHighPressure] = useState('');
  const [lowPressure, setLowPressure] = useState('');
  const [liquidTemp, setLiquidTemp] = useState('');
  const [suctionTemp, setSuctionTemp] = useState('');
  const [superheat, setSuperheat] = useState('');
  const [subcooling, setSubcooling] = useState('');
  const [ambientTemp, setAmbientTemp] = useState('');
  const [supplyTemp, setSupplyTemp] = useState('');
  const [returnTemp, setReturnTemp] = useState('');
  const [deltaT, setDeltaT] = useState('');
  const [voltage, setVoltage] = useState('');
  const [amps, setAmps] = useState('');
  const [refrigerantType, setRefrigerantType] = useState(firstUnit?.refrigerantType || '');
  const [refrigerantLbs, setRefrigerantLbs] = useState('');
  const [refrigerantOz, setRefrigerantOz] = useState('');

  // Notes state
  const [diagnosisNotes, setDiagnosisNotes] = useState(job?.notes?.diagnosis || '');
  const [workNotes, setWorkNotes] = useState(job?.notes?.workNotes || job?.notes?.completion || '');
  const [techRecommendations, setTechRecommendations] = useState(job?.techRecommendations || '');

  // Parts table state (3 blank rows)
  const [parts, setParts] = useState(
    job?.partsUsed && job.partsUsed.length > 0 
      ? job.partsUsed.map(p => ({ desc: p.name || '', sku: p.sku || '', qty: String(p.quantity || 1), cost: String(p.unitPrice || '') }))
      : [
          { desc: '', sku: '', qty: '', cost: '' },
          { desc: '', sku: '', qty: '', cost: '' },
          { desc: '', sku: '', qty: '', cost: '' }
        ]
  );

  const rawTech = (job as any)?.technicianName || 
    (job as any)?.assignedTech || 
    (job as any)?.techName || 
    (job as any)?.signOffSheet?.techName || 
    '';
  const initialTechName = (rawTech && !rawTech.toLowerCase().includes('dispatch')) ? rawTech : 'Technician';

  const [techSignature, setTechSignature] = useState((job as any)?.techSignature || (job as any)?.signOffSheet?.techSignature || '');
  const [techName, setTechName] = useState(initialTechName);
  const [customerSignature, setCustomerSignature] = useState((job as any)?.customerSignature || (job as any)?.signOffSheet?.managerSignature || '');
  const [managerName, setManagerName] = useState((job as any)?.signOffSheet?.managerName || (job as any)?.managerName || '');
  const [storeStamp, setStoreStamp] = useState((job as any)?.signOffSheet?.storeStamp || (job as any)?.storeStamp || '');
  const [managerSigMode, setManagerSigMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [techSigMode, setTechSigMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const managerSigFileRef = useRef<HTMLInputElement>(null);
  const techSigFileRef = useRef<HTMLInputElement>(null);
  const [photoAttachments, setPhotoAttachments] = useState<PhotoAttachmentItem[]>([]);

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImg = file.type.startsWith('image/') || /\.(jpeg|jpg|png|webp|gif|heic)$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isImg && !isPdf) {
      alert('Please upload an image file (JPG, PNG, HEIC) or PDF document.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const jobPhotos = React.useMemo(() => {
    const list: Array<{ url: string; label: string }> = [];
    const seen = new Set<string>();

    (job?.files || []).forEach((f: any) => {
      const url = f.dataUrl || f.url || f.fileUrl;
      const isImg = f.fileType?.startsWith('image/') || f.contentType?.startsWith('image/') || f.type === 'Photo' || (url && url.match(/\.(jpeg|jpg|png|webp|gif|heic)($|\?)/i));
      if (isImg && url && !seen.has(url)) {
        seen.add(url);
        list.push({ url, label: f.metadata?.label || f.label || 'Job Photo' });
      }
    });

    const safeUnitStatesList = Array.isArray(job?.unitStates) ? job.unitStates : (typeof job?.unitStates === 'object' && job?.unitStates ? Object.values(job.unitStates) : []);
    safeUnitStatesList.forEach((u: any) => {
      [u.beforePhotoUrl, u.afterPhotoUrl, u.dataPlatePhotoUrl, u.photoUrl].forEach(url => {
        if (url && !seen.has(url)) {
          seen.add(url);
          list.push({ url, label: 'Unit Photo' });
        }
      });
    });

    return list;
  }, [job]);

  useEffect(() => {
    if (job) {
      setCustomerName(job.customerName || '');
      setCustomerPhone(job.customerPhone || '');
      setCustomerEmail(job.customerEmail || '');
      setServiceAddress(
        typeof job.address === 'string'
          ? job.address
          : (job.address ? `${job.address.street || ''}, ${job.address.city || ''} ${job.address.state || ''}` : '')
      );
      setWorkOrderNo(job.workOrderNumber || job.poNumber || job.id || '');
      setAppointmentDate(safeFormatDateString(job.appointmentTime));
      setAppointmentTime(safeFormatTimeString(job.appointmentTime, { hour: '2-digit', minute: '2-digit' }));
      setVisitType(job.visitType || 'Diagnostic & Repair');

      const savedForm = (job as any)?.subcontractorFormData || (job as any)?.draftData || {};
      const firstJobUnit = Array.isArray(job?.unitStates) ? job?.unitStates?.[0] : null;

      setUnitLocation(savedForm.unitLocation || firstJobUnit?.assetId || '');
      setBrand(savedForm.brand || job.hvacBrand || '');
      setModelNo(savedForm.modelNo || '');
      setSerialNo(savedForm.serialNo || '');
      setHealthStatus(savedForm.healthStatus || firstJobUnit?.health || 'Good');

      const rd = Array.isArray((job as any).readings) ? ((job as any).readings[0] || {}) : ((job as any).readings || {});
      setHighPressure(savedForm.highPressure || rd.highPressure || '');
      setLowPressure(savedForm.lowPressure || rd.lowPressure || '');
      setLiquidTemp(savedForm.liquidTemp || rd.liquidTemp || '');
      setSuctionTemp(savedForm.suctionTemp || rd.suctionTemp || '');
      setSuperheat(savedForm.superheat || rd.superheat || '');
      setSubcooling(savedForm.subcooling || rd.subcooling || '');
      setAmbientTemp(savedForm.ambientTemp || rd.ambientTemp || '');
      setSupplyTemp(savedForm.supplyTemp || rd.supplyTemp || '');
      setReturnTemp(savedForm.returnTemp || rd.returnTemp || '');
      setDeltaT(savedForm.deltaT || rd.deltaT || '');
      setVoltage(savedForm.voltage || rd.voltage || '');
      setAmps(savedForm.amps || rd.amps || '');
      setRefrigerantType(savedForm.refrigerantType || rd.refrigerantType || firstJobUnit?.refrigerantType || '');
      setRefrigerantLbs(savedForm.refrigerantLbs || rd.refrigerantLbs || '');
      setRefrigerantOz(savedForm.refrigerantOz || rd.refrigerantOz || '');

      setDiagnosisNotes(savedForm.diagnosisNotes || job.notes?.diagnosis || '');
      setWorkNotes(savedForm.workNotes || job.notes?.workNotes || job.notes?.completion || '');
      setTechRecommendations(savedForm.techRecommendations || job.techRecommendations || '');

      if (savedForm.parts && Array.isArray(savedForm.parts) && savedForm.parts.length > 0) {
        setParts(savedForm.parts);
      } else if (job.partsUsed && job.partsUsed.length > 0) {
        setParts(job.partsUsed.map(p => ({ desc: p.name || '', sku: p.sku || '', qty: String(p.quantity || 1), cost: String(p.unitPrice || '') })));
      }

      const sigSheet = (job as any)?.signOffSheet || {};
      setTechSignature(savedForm.techSignature || (job as any)?.techSignature || sigSheet.techSignature || '');
      setTechName(savedForm.techName || sigSheet.techName || initialTechName);
      setCustomerSignature(savedForm.customerSignature || (job as any)?.customerSignature || sigSheet.managerSignature || '');
      setManagerName(savedForm.managerName || sigSheet.managerName || (job as any)?.managerName || '');
      setStoreStamp(savedForm.storeStamp || sigSheet.storeStamp || (job as any)?.storeStamp || '');
    }
  }, [job]);

  useEffect(() => {
    if (onChangeData) {
      onChangeData({
        customerName,
        customerPhone,
        customerEmail,
        serviceAddress,
        workOrderNo,
        appointmentDate,
        appointmentTime,
        visitType,
        unitLocation,
        brand,
        modelNo,
        serialNo,
        healthStatus,
        highPressure,
        lowPressure,
        liquidTemp,
        suctionTemp,
        superheat,
        subcooling,
        ambientTemp,
        supplyTemp,
        returnTemp,
        deltaT,
        voltage,
        amps,
        refrigerantType,
        refrigerantLbs,
        refrigerantOz,
        diagnosisNotes,
        workNotes,
        techRecommendations,
        parts,
        techSignature,
        techName,
        customerSignature,
        managerName,
        storeStamp,
        photoAttachments,
        photos: photoAttachments.map(p => p.file)
      });
    }
  }, [
    customerName, customerPhone, customerEmail, serviceAddress, workOrderNo,
    appointmentDate, appointmentTime, visitType, unitLocation, brand, modelNo,
    serialNo, healthStatus, highPressure, lowPressure, liquidTemp, suctionTemp,
    superheat, subcooling, ambientTemp, supplyTemp, returnTemp, deltaT, voltage,
    amps, refrigerantType, refrigerantLbs, refrigerantOz, diagnosisNotes, workNotes,
    techRecommendations, parts, techSignature, techName, customerSignature, managerName, storeStamp, photoAttachments
  ]);

  const updatePart = (index: number, field: string, val: string) => {
    const updated = [...parts];
    updated[index] = { ...updated[index], [field]: val };
    setParts(updated);
  };

  return (
    <div className="printable-form-wrapper bg-white text-slate-900 font-sans leading-normal w-full max-w-full overflow-hidden box-border px-1 sm:px-3">
      <style>{`
        @page {
          size: letter portrait;
          margin: 0.2in;
        }
        @media print {
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden;
          }
          .printable-form-wrapper, .printable-form-wrapper * {
            visibility: visible;
          }
          .printable-form-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .printable-sheet {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 0 0 0 !important;
            padding: 0.2in !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            border-width: 2px !important;
          }
          .printable-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          input, textarea, select {
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            outline: none !important;
            color: #000000 !important;
            font-weight: bold !important;
            line-height: 1.2 !important;
            padding: 2px 0 !important;
          }
          input::placeholder, textarea::placeholder, ::placeholder {
            color: transparent !important;
            opacity: 0 !important;
          }
        }
      `}</style>

      {copies.map((_, copyIndex) => (
        <div 
          key={copyIndex} 
          className={`printable-sheet p-2.5 sm:p-5 w-full max-w-full overflow-hidden border-2 border-slate-900 rounded-xl my-2 bg-white box-border shadow-sm ${
            copyIndex < copies.length - 1 ? 'mb-6' : ''
          }`}
        >
          
          {/* HEADER SECTION */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-800 pb-2 mb-2 gap-2">
            <div>
              {logo ? (
                <div className="mb-1 flex items-center gap-2">
                  <img src={logo} alt={orgName} className="h-8 sm:h-10 max-w-[140px] sm:max-w-[180px] object-contain" />
                  <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">{orgName}</h1>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-slate-900" />
                  <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">{orgName}</h1>
                </div>
              )}
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-700 mt-0.5">{orgPhone} | {orgEmail}</p>
              <p className="text-[9px] text-slate-500 font-medium">Official Field Inspection Work Order Form</p>
            </div>

            <div className="w-full sm:w-auto text-left sm:text-right border-t sm:border-t-0 sm:border-l-2 border-slate-300 pt-2 sm:pt-0 sm:pl-3 min-w-0 sm:min-w-[180px]">
              <div className="bg-slate-900 text-white px-2 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded inline-block sm:block">
                FIELD SERVICE FORM
              </div>
              <div className="mt-1 flex items-center sm:justify-end gap-1 text-[11px] font-bold text-slate-800">
                <span>WO / PO #:</span>
                <input
                  type="text"
                  value={workOrderNo}
                  onChange={(e) => setWorkOrderNo(e.target.value)}
                  className="font-mono text-xs font-black text-left sm:text-right underline min-w-[110px] max-w-[180px] bg-transparent leading-normal h-6"
                />
              </div>
              <div className="mt-0.5 flex items-center sm:justify-end gap-1 text-[11px] text-slate-700 font-semibold">
                <span>Date:</span>
                <input
                  type="text"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="font-mono text-xs font-bold text-left sm:text-right min-w-[100px] max-w-[150px] bg-transparent leading-normal h-6"
                />
              </div>
            </div>
          </div>

          {/* PRIME CONTRACTOR & SERVICE LOCATION (CUSTOMER CONTACT INFO HIDDEN FOR PRIVACY) */}
          {(() => {
            const siteLocationName = (job as any)?.siteLocationName || (job as any)?.siteName || (typeof job?.address === 'object' && (job?.address as any)?.name) || '';
            const subWorkOrder = (job as any)?.subcontractorWorkOrder;
            const subNte = subWorkOrder?.nte || (job as any)?.partnerPayoutAmount || (job as any)?.subcontractorPayRate || (job as any)?.subcontractorNte;
            const nteAmountDisplay = subNte ? `$${subNte}.00` : 'Not Specified';
            const reportedIssue = subWorkOrder?.reportedIssue || job?.notes?.preRepair || job?.notes?.diagnosis || (job as any)?.description || job?.visitType || 'Diagnostic & Repair Work Order';
            const ivrPhone = subWorkOrder?.ivrNumber || '';
            const ivrPin = subWorkOrder?.ivrPin || (job as any)?.poNumber || '';
            const specialInstructions = subWorkOrder?.specialInstructions || (job as any)?.specialInstructions || '';
            const visitInstructions = subWorkOrder?.visitInstructions || [];

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 border-2 border-slate-800 rounded-lg p-2.5 mb-2 bg-slate-50">
                  <div>
                    <div className="text-[10px] font-black uppercase text-indigo-900 tracking-wider mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Prime Contractor
                    </div>
                    <div className="text-xs font-bold text-slate-900 space-y-0.5">
                      <div className="font-black text-sm text-slate-900">{orgName}</div>
                      <div className="text-slate-600 text-[11px]">Phone: {orgPhone}</div>
                      <div className="text-slate-600 text-[11px] truncate">Email: {orgEmail}</div>
                      <div className="text-[10px] text-indigo-600 font-semibold mt-1">Dispatching Organization</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-700 tracking-wider mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Service Site Location
                    </div>
                    <div className="text-xs font-bold text-slate-900 space-y-1">
                      {siteLocationName && (
                        <div className="font-black text-slate-900 text-xs">{siteLocationName}</div>
                      )}
                      <div className="flex items-start gap-1">
                        <span className="text-slate-600 font-bold text-[11px] shrink-0">Address:</span>
                        <span className="font-bold text-xs text-slate-900 break-words leading-tight">{serviceAddress}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-slate-600 font-bold shrink-0">Appt Time:</span>
                        <span className="font-mono text-slate-800">{appointmentDate} {appointmentTime}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TEKTRAKKER SUBCONTRACTOR WORKORDER DETAILS (ONLY ON PRINT COPIES, HIDDEN ON INTERACTIVE FORM) */}
                {!interactive && (
                  <div className="border-2 border-indigo-900 bg-indigo-950/5 text-slate-900 rounded-lg p-2.5 mb-2">
                    <div className="flex flex-wrap items-center justify-between text-xs font-black uppercase tracking-wider border-b border-indigo-200 pb-1 mb-1.5 text-indigo-950 gap-1">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" /> TekTrakker Subcontractor Work Order
                      </span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-black">
                        WO #{workOrderNo}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="sm:col-span-2 space-y-2">
                        <div>
                          <span className="block text-[9px] font-black uppercase text-slate-600 mb-0.5">Reported Issue &amp; Work Scope:</span>
                          <p className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded p-1.5 leading-snug break-words">
                            {reportedIssue}
                          </p>
                        </div>

                        {specialInstructions && (
                          <div>
                            <span className="block text-[9px] font-black uppercase text-amber-800 mb-0.5">Special Dispatcher Instructions:</span>
                            <p className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded p-1.5 leading-snug break-words">
                              {specialInstructions}
                            </p>
                          </div>
                        )}

                        {ivrPhone && (
                          <div className="bg-slate-100 border border-slate-300 rounded p-1.5 text-[11px]">
                            <span className="block text-[9px] font-black uppercase text-slate-700">IVR Check-In / Check-Out Procedure:</span>
                            <span className="font-bold text-slate-900">Call {ivrPhone} upon arrival &amp; departure to log hours.</span>
                            {ivrPin && <span className="ml-2 font-mono text-slate-700">(Security PIN / Job #: {ivrPin})</span>}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-2 text-center">
                          <span className="block text-[9px] font-black uppercase text-emerald-800">Approved Subcontractor NTE Limit:</span>
                          <span className="font-mono text-base font-black text-emerald-950 flex items-center justify-center gap-1">
                            <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" /> {nteAmountDisplay}
                          </span>
                          <span className="block text-[8px] text-emerald-700 font-semibold mt-0.5">Pre-Approval Required for Increases</span>
                        </div>
                      </div>
                    </div>

                    {visitInstructions && visitInstructions.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-indigo-200">
                        <span className="block text-[9px] font-black uppercase text-slate-600 mb-1">Visit Requirements &amp; Mandatory Guidelines:</span>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-slate-700 list-disc list-inside bg-white/70 p-2 rounded border border-slate-200">
                          {visitInstructions.map((item: string, idx: number) => (
                            <li key={idx} className="font-medium truncate">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          {/* EQUIPMENT & SYSTEM HEALTH */}
          <div className="border-2 border-slate-800 rounded-lg p-2.5 mb-2">
            <div className="text-xs font-black uppercase tracking-wider text-slate-900 mb-1.5 border-b border-slate-300 pb-0.5 flex flex-wrap justify-between gap-1">
              <span>Equipment &amp; Asset Identification</span>
              <span className="text-[9px] text-slate-500 font-semibold">FILL ALL FIELDS IF NEW OR MODIFIED</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
              <div>
                <label className="block text-[9px] font-black text-slate-600 uppercase">Unit Location / Area</label>
                <input
                  type="text"
                  value={unitLocation}
                  onChange={(e) => setUnitLocation(e.target.value)}
                  className="w-full border-b border-slate-400 font-bold py-0.5 bg-transparent leading-normal h-6 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-600 uppercase">Brand / Manufacturer</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full border-b border-slate-400 font-bold py-0.5 bg-transparent leading-normal h-6 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-600 uppercase">Model Number (M/N)</label>
                <input
                  type="text"
                  value={modelNo}
                  onChange={(e) => setModelNo(e.target.value)}
                  className="w-full border-b border-slate-400 font-bold py-0.5 bg-transparent leading-normal h-6 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-600 uppercase">Serial Number (S/N)</label>
                <input
                  type="text"
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  className="w-full border-b border-slate-400 font-bold py-0.5 bg-transparent leading-normal h-6 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs bg-slate-100 p-1.5 rounded border border-slate-300">
              <span className="font-black text-slate-900 uppercase text-[10px] shrink-0">System Health Status:</span>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-bold">
                {['Good', 'Fair', 'Poor', 'Critical'].map((status) => (
                  <label key={status} className="flex items-center gap-1 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name={`health-${copyIndex}`}
                      value={status}
                      checked={healthStatus === status}
                      onChange={() => setHealthStatus(status)}
                      className="w-3.5 h-3.5 accent-slate-900 cursor-pointer"
                    />
                    <span className={status === 'Critical' ? 'text-red-700 font-black' : 'text-slate-800 font-bold'}>[{status.toUpperCase()}]</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* FIELD GAUGE / TOOL READINGS (RESPONSIVE GRID) */}
          <div className="border-2 border-slate-800 rounded-lg p-2.5 mb-2 overflow-hidden">
            <div className="text-xs font-black uppercase tracking-wider text-slate-900 mb-1.5 border-b border-slate-300 pb-0.5">
              {isHvacTrade(job, organization) ? 'Field Gauge & Refrigerant Tool Readings' : 'Field Equipment & Diagnostic Tool Readings'}
            </div>

            {isHvacTrade(job, organization) ? (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-1.5 text-center text-xs">
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">HIGH PRESS (PSI)</span>
                    <input type="text" value={highPressure} onChange={e => setHighPressure(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">LOW PRESS (PSI)</span>
                    <input type="text" value={lowPressure} onChange={e => setLowPressure(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">LIQUID TEMP (°F)</span>
                    <input type="text" value={liquidTemp} onChange={e => setLiquidTemp(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">SUCTION TEMP (°F)</span>
                    <input type="text" value={suctionTemp} onChange={e => setSuctionTemp(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">SUPERHEAT (°F)</span>
                    <input type="text" value={superheat} onChange={e => setSuperheat(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">SUBCOOLING (°F)</span>
                    <input type="text" value={subcooling} onChange={e => setSubcooling(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-1.5 text-center text-xs mt-1.5">
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">AMBIENT TEMP (°F)</span>
                    <input type="text" value={ambientTemp} onChange={e => setAmbientTemp(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">SUPPLY TEMP (°F)</span>
                    <input type="text" value={supplyTemp} onChange={e => setSupplyTemp(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">RETURN TEMP (°F)</span>
                    <input type="text" value={returnTemp} onChange={e => setReturnTemp(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">DELTA T (°F)</span>
                    <input type="text" value={deltaT} onChange={e => setDeltaT(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">VOLTAGE (V)</span>
                    <input type="text" value={voltage} onChange={e => setVoltage(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                  <div className="border border-slate-400 p-1 rounded bg-slate-50 min-w-0">
                    <span className="block text-[7.5px] sm:text-[8px] font-black uppercase text-slate-600 truncate">AMPERAGE (A)</span>
                    <input type="text" value={amps} onChange={e => setAmps(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" />
                  </div>
                </div>

                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs px-1 gap-2 border-t border-slate-200 pt-2">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="font-bold text-slate-800 shrink-0">Refrigerant Type:</span>
                    <input type="text" value={refrigerantType} onChange={e => setRefrigerantType(e.target.value)} className="font-mono border-b border-slate-400 bg-transparent px-1 text-xs font-bold leading-normal h-6 w-full sm:w-32" />
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="font-bold text-slate-800 shrink-0">Refrigerant Added:</span>
                    <input type="text" value={refrigerantLbs} onChange={e => setRefrigerantLbs(e.target.value)} className="w-10 font-mono text-center border-b border-slate-400 bg-transparent text-xs font-bold leading-normal h-6" /> lbs
                    <input type="text" value={refrigerantOz} onChange={e => setRefrigerantOz(e.target.value)} className="w-10 font-mono text-center border-b border-slate-400 bg-transparent text-xs font-bold leading-normal h-6" /> oz
                  </div>
                </div>
              </>
            ) : (() => {
              const activeTradeName = resolveJobTrade(job, organization).toUpperCase();
              if (activeTradeName.includes('ELECTR')) {
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs py-1">
                    <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">VOLTAGE (V)</span>
                      <input type="text" value={voltage} onChange={e => setVoltage(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="120V / 240V" />
                    </div>
                    <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">AMPERAGE (A)</span>
                      <input type="text" value={amps} onChange={e => setAmps(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="15A / 20A" />
                    </div>
                    <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">RESISTANCE (Ω)</span>
                      <input type="text" value={highPressure} onChange={e => setHighPressure(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="0.5 Ohms" />
                    </div>
                    <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">WIRE GAUGE / CONDUIT</span>
                      <input type="text" value={lowPressure} onChange={e => setLowPressure(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="12 AWG / 3/4in" />
                    </div>
                  </div>
                );
              }
              if (activeTradeName.includes('PLUMB')) {
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs py-1">
                    <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">WATER PRESS (PSI)</span>
                      <input type="text" value={highPressure} onChange={e => setHighPressure(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="60 PSI" />
                    </div>
                    <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">FLOW RATE (GPM)</span>
                      <input type="text" value={lowPressure} onChange={e => setLowPressure(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="8 GPM" />
                    </div>
                    <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">PIPE SIZE / MATERIAL</span>
                      <input type="text" value={voltage} onChange={e => setVoltage(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="3/4in Copper" />
                    </div>
                    <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                      <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">HYDROSTATIC TEST</span>
                      <input type="text" value={amps} onChange={e => setAmps(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="PASS / 100 PSI" />
                    </div>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs py-1">
                  <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                    <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">VOLTAGE (V)</span>
                    <input type="text" value={voltage} onChange={e => setVoltage(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="120V / 240V" />
                  </div>
                  <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                    <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">AMPERAGE (A)</span>
                    <input type="text" value={amps} onChange={e => setAmps(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="15A / 20A" />
                  </div>
                  <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                    <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">RESISTANCE (Ω)</span>
                    <input type="text" value={highPressure} onChange={e => setHighPressure(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="0.5 Ohms" />
                  </div>
                  <div className="border border-slate-400 p-1.5 rounded bg-slate-50 min-w-0">
                    <span className="block text-[8px] sm:text-[9px] font-black uppercase text-slate-600 truncate">WIRE GAUGE / CONDUIT</span>
                    <input type="text" value={lowPressure} onChange={e => setLowPressure(e.target.value)} className="w-full text-center font-mono font-bold text-xs bg-transparent h-6 leading-normal" placeholder="12 AWG / 3/4in" />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* DIAGNOSIS & WORK NOTES */}
          <div className="border-2 border-slate-800 rounded-lg p-2.5 mb-2">
            <div className="text-xs font-black uppercase tracking-wider text-slate-900 mb-1 border-b border-slate-300 pb-0.5">
              Diagnosis &amp; Work Performed Findings
            </div>
            
            <div className="mb-1.5">
              <label className="block text-[9px] font-bold text-slate-700 uppercase mb-0.5">Initial Diagnosis / Cause of Failure:</label>
              <textarea
                rows={2}
                value={diagnosisNotes}
                onChange={(e) => setDiagnosisNotes(e.target.value)}
                className="w-full border border-slate-400 rounded p-1.5 text-xs bg-white font-sans resize-none leading-snug"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-700 uppercase mb-0.5">Work Performed / Repairs Executed:</label>
              <textarea
                rows={2}
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                className="w-full border border-slate-400 rounded p-1.5 text-xs bg-white font-sans resize-none leading-snug"
              />
            </div>
          </div>

          {/* PARTS USED TABLE */}
          <div className="border-2 border-slate-800 rounded-lg p-2.5 mb-2 overflow-hidden">
            <div className="text-xs font-black uppercase tracking-wider text-slate-900 mb-1 border-b border-slate-300 pb-0.5 flex flex-wrap justify-between gap-1">
              <span>Parts &amp; Materials Consumed</span>
              <span className="text-[9px] text-slate-500 font-semibold">FILL PART DESC, SKU &amp; QTY</span>
            </div>

            <div className="overflow-x-auto w-full border border-slate-300 rounded">
              <table className="w-full text-xs border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 border-b border-slate-400">
                    <th className="p-0.5 text-center w-8 border-r border-slate-400 font-black">#</th>
                    <th className="p-0.5 text-left border-r border-slate-400 font-black px-1">Part Description / Name</th>
                    <th className="p-0.5 text-left w-24 border-r border-slate-400 font-black px-1">SKU / Part No</th>
                    <th className="p-0.5 text-center w-12 border-r border-slate-400 font-black">Qty</th>
                    <th className="p-0.5 text-right w-20 font-black px-1">Unit Cost ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p, idx) => (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="p-0.5 text-center font-bold text-slate-600 border-r border-slate-300">{idx + 1}</td>
                      <td className="p-0.5 border-r border-slate-300">
                        <input type="text" value={p.desc} onChange={e => updatePart(idx, 'desc', e.target.value)} className="w-full bg-transparent border-none text-xs font-semibold px-1 leading-normal h-6" />
                      </td>
                      <td className="p-0.5 border-r border-slate-300">
                        <input type="text" value={p.sku} onChange={e => updatePart(idx, 'sku', e.target.value)} className="w-full bg-transparent border-none text-xs font-semibold px-1 leading-normal h-6" />
                      </td>
                      <td className="p-0.5 border-r border-slate-300">
                        <input type="text" value={p.qty} onChange={e => updatePart(idx, 'qty', e.target.value)} className="w-full text-center bg-transparent border-none text-xs font-bold leading-normal h-6" />
                      </td>
                      <td className="p-0.5">
                        <input type="text" value={p.cost} onChange={e => updatePart(idx, 'cost', e.target.value)} className="w-full text-right bg-transparent border-none text-xs font-bold px-1 leading-normal h-6" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RECOMMENDATIONS */}
          <div className="border-2 border-slate-800 rounded-lg p-2.5 bg-slate-50 mb-2">
            <div className="text-[9px] font-black uppercase text-slate-600 tracking-wider mb-0.5">
              Technician Recommendation &amp; Follow-up
            </div>
            <textarea
              rows={2}
              value={techRecommendations}
              onChange={(e) => setTechRecommendations(e.target.value)}
              className="w-full border border-slate-400 bg-white rounded p-1 text-xs resize-none leading-snug"
            />
          </div>

          {/* OFFICIAL JOB COMPLETION & DUAL SIGN-OFF SHEET */}
          <div className="border-2 border-slate-900 rounded-xl p-3 bg-gradient-to-b from-slate-50 to-white mb-2 shadow-sm">
            <div className="text-xs font-black uppercase tracking-wider text-slate-900 mb-1 border-b-2 border-slate-800 pb-1 flex flex-wrap justify-between items-center gap-1">
              <span className="flex items-center gap-1.5 text-slate-900">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" /> Official Job Completion &amp; Dual Sign-Off Sheet
              </span>
              <span className="text-[9px] bg-slate-900 text-white px-2 py-0.5 rounded font-black tracking-widest">
                VERIFIED COMPLETION
              </span>
            </div>
            <p className="text-[10px] text-slate-600 mb-3 italic">
              Technician &amp; Site Manager sign-off confirming that all work order scope items, readings, notes, and photos are accurate and completed in full.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* SITE MANAGER SIGN-OFF CARD */}
              <div className="border border-slate-300 rounded-lg p-2.5 bg-white shadow-xs">
                <div className="flex items-center justify-between text-xs font-black text-slate-900 border-b border-slate-200 pb-1 mb-2">
                  <span className="flex items-center gap-1 text-slate-800">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" /> 1. Site Manager / Customer Acceptance
                  </span>
                  {interactive && (
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setManagerSigMode('draw')} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${managerSigMode === 'draw' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'}`}>✏️ Draw</button>
                      <button type="button" onClick={() => setManagerSigMode('type')} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${managerSigMode === 'type' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'}`}>⌨️ Type</button>
                      <button type="button" onClick={() => { setManagerSigMode('upload'); managerSigFileRef.current?.click(); }} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${managerSigMode === 'upload' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-50'}`}>📸 Upload</button>
                      <input ref={managerSigFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => handleSignatureUpload(e, setCustomerSignature)} />
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase">Manager Printed Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe (Store Manager)"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      className="w-full border-b border-slate-400 font-bold py-0.5 bg-transparent text-xs text-slate-900 leading-normal h-6"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase">Store Stamp / Location Details</label>
                    <input
                      type="text"
                      placeholder="e.g. Humana Store #1024 / Stamp"
                      value={storeStamp}
                      onChange={(e) => setStoreStamp(e.target.value)}
                      className="w-full border-b border-slate-400 font-medium py-0.5 bg-transparent text-xs text-slate-800 leading-normal h-6"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-700 uppercase mb-1">Manager Signature</label>
                    {interactive ? (
                      managerSigMode === 'draw' ? (
                        <div className="border border-slate-300 rounded overflow-hidden">
                          <SignaturePad onEnd={(data) => setCustomerSignature(data)} />
                        </div>
                      ) : managerSigMode === 'type' ? (
                        <input
                          type="text"
                          placeholder="Type Manager Full Signature..."
                          value={customerSignature}
                          onChange={(e) => setCustomerSignature(e.target.value)}
                          className="w-full border-b-2 border-slate-800 font-mono font-bold text-xs py-1 text-slate-900 bg-transparent"
                        />
                      ) : (
                        <div className="border-2 border-dashed border-indigo-300 rounded-lg p-3 text-center bg-indigo-50/50">
                          {customerSignature?.startsWith('data:image') ? (
                            <div className="space-y-2">
                              <img src={customerSignature} className="max-h-20 mx-auto object-contain rounded border border-slate-200" alt="Uploaded Manager Signature" />
                              <button type="button" onClick={() => managerSigFileRef.current?.click()} className="text-[9px] font-bold text-indigo-600 hover:underline">📸 Replace Photo</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => managerSigFileRef.current?.click()} className="flex flex-col items-center gap-1 mx-auto text-indigo-600 hover:text-indigo-800">
                              <ImageIcon className="w-6 h-6" />
                              <span className="text-[10px] font-bold">Tap to upload signature photo</span>
                              <span className="text-[8px] text-slate-500">JPG, PNG, or take a photo</span>
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="border-b border-slate-800 min-h-[30px] flex items-center justify-between font-mono text-xs text-slate-900">
                        {customerSignature?.startsWith('data:image') ? (
                          <img src={customerSignature} className="max-h-8 object-contain" alt="Manager Signature" />
                        ) : (
                          <span>X {customerSignature || managerName || '____________________'}</span>
                        )}
                        <span className="text-[10px] text-slate-500">{new Date().toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TECHNICIAN CERTIFICATION & SIGN-OFF CARD */}
              <div className="border border-slate-300 rounded-lg p-2.5 bg-white shadow-xs">
                <div className="flex items-center justify-between text-xs font-black text-slate-900 border-b border-slate-200 pb-1 mb-2">
                  <span className="flex items-center gap-1 text-slate-800">
                    <PenTool className="w-3.5 h-3.5 text-emerald-600" /> 2. Technician Certification &amp; Sign-off
                  </span>
                  {interactive && (
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setTechSigMode('draw')} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${techSigMode === 'draw' ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:bg-emerald-50'}`}>✏️ Draw</button>
                      <button type="button" onClick={() => setTechSigMode('type')} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${techSigMode === 'type' ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:bg-emerald-50'}`}>⌨️ Type</button>
                      <button type="button" onClick={() => { setTechSigMode('upload'); techSigFileRef.current?.click(); }} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${techSigMode === 'upload' ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:bg-emerald-50'}`}>📸 Upload</button>
                      <input ref={techSigFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => handleSignatureUpload(e, setTechSignature)} />
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase">Technician Printed Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Trey Bowen (Lead Tech)"
                      value={techName}
                      onChange={(e) => setTechName(e.target.value)}
                      className="w-full border-b border-slate-400 font-bold py-0.5 bg-transparent text-xs text-slate-900 leading-normal h-6"
                    />
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded p-1.5 text-[9.5px] text-emerald-950 leading-snug">
                    <span className="font-bold">Accuracy Certification:</span> I certify that all work, equipment readings, diagnostic notes, consumed parts, and attached photos submitted for this work order are 100% accurate and complete.
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-700 uppercase mb-1">Technician Signature</label>
                    {interactive ? (
                      techSigMode === 'draw' ? (
                        <div className="border border-slate-300 rounded overflow-hidden">
                          <SignaturePad onEnd={(data) => setTechSignature(data)} />
                        </div>
                      ) : techSigMode === 'type' ? (
                        <input
                          type="text"
                          placeholder="Type Technician Full Signature..."
                          value={techSignature}
                          onChange={(e) => setTechSignature(e.target.value)}
                          className="w-full border-b-2 border-slate-800 font-mono font-bold text-xs py-1 text-slate-900 bg-transparent"
                        />
                      ) : (
                        <div className="border-2 border-dashed border-emerald-300 rounded-lg p-3 text-center bg-emerald-50/50">
                          {techSignature?.startsWith('data:image') ? (
                            <div className="space-y-2">
                              <img src={techSignature} className="max-h-20 mx-auto object-contain rounded border border-slate-200" alt="Uploaded Tech Signature" />
                              <button type="button" onClick={() => techSigFileRef.current?.click()} className="text-[9px] font-bold text-emerald-600 hover:underline">📸 Replace Photo</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => techSigFileRef.current?.click()} className="flex flex-col items-center gap-1 mx-auto text-emerald-600 hover:text-emerald-800">
                              <ImageIcon className="w-6 h-6" />
                              <span className="text-[10px] font-bold">Tap to upload signature photo</span>
                              <span className="text-[8px] text-slate-500">JPG, PNG, or take a photo</span>
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="border-b border-slate-800 min-h-[30px] flex items-center justify-between font-mono text-xs text-slate-900">
                        {techSignature?.startsWith('data:image') ? (
                          <img src={techSignature} className="max-h-8 object-contain" alt="Tech Signature" />
                        ) : (
                          <span>X {techSignature || techName || '____________________'}</span>
                        )}
                        <span className="text-[10px] text-slate-500">{new Date().toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PHOTO ATTACHMENTS FOR INTERACTIVE FORM WITH BEFORE/AFTER & CUSTOM LABELS */}
          {interactive && (
            <div className="mt-3 border-2 border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-950">
                    <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Job Site Photos &amp; Labeling</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Attach photos from your camera and tag each as <span className="font-bold text-blue-700">Before</span>, <span className="font-bold text-emerald-700">After</span>, <span className="font-bold text-amber-700">Data Plate</span>, or enter custom labels.
                  </p>
                </div>
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all">
                  <Upload className="w-3.5 h-3.5 shrink-0" /> Attach Photos
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const files = Array.from(e.target.files);
                        const newItems: PhotoAttachmentItem[] = files.map((file, i) => ({
                          file,
                          previewUrl: URL.createObjectURL(file),
                          category: 'After',
                          customLabel: ''
                        }));
                        setPhotoAttachments(prev => [...prev, ...newItems]);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>

              {photoAttachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                  {photoAttachments.map((item, idx) => (
                    <div key={idx} className="relative group bg-white border-2 border-slate-300 rounded-xl p-2 shadow-xs flex flex-col justify-between">
                      <div>
                        {/* PHOTO THUMBNAIL */}
                        <div className="relative w-full h-32 bg-slate-900 rounded-lg overflow-hidden mb-2">
                          <img
                            src={item.previewUrl}
                            alt={`Job attachment ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setPhotoAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1.5 right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md"
                            title="Remove Photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                            {(item.file.size / 1024).toFixed(0)} KB
                          </span>
                        </div>

                        {/* CATEGORY TAG PILLS */}
                        <div className="mb-2">
                          <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Select Photo Category:</label>
                          <div className="flex flex-wrap gap-1">
                            {(['Before', 'After', 'Data Plate', 'Repair', 'Custom'] as const).map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setPhotoAttachments(prev => {
                                    const updated = [...prev];
                                    updated[idx] = { ...updated[idx], category: cat };
                                    return updated;
                                  });
                                }}
                                className={`px-2 py-0.5 rounded-full text-[9.5px] font-black tracking-wide transition-all ${
                                  item.category === cat
                                    ? cat === 'Before' ? 'bg-blue-600 text-white shadow-xs'
                                    : cat === 'After' ? 'bg-emerald-600 text-white shadow-xs'
                                    : cat === 'Data Plate' ? 'bg-amber-600 text-white shadow-xs'
                                    : cat === 'Repair' ? 'bg-purple-600 text-white shadow-xs'
                                    : 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                                }`}
                              >
                                {cat === 'Before' && '🔵 '}
                                {cat === 'After' && '🟢 '}
                                {cat === 'Data Plate' && '🏷️ '}
                                {cat === 'Repair' && '🔧 '}
                                {cat === 'Custom' && '✏️ '}
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* CUSTOM LABEL TEXT INPUT */}
                        <div>
                          <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Optional Custom Label / Notes:</label>
                          <input
                            type="text"
                            placeholder="e.g. Condensate Drain Pan Clog, Thermostat..."
                            value={item.customLabel}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPhotoAttachments(prev => {
                                const updated = [...prev];
                                updated[idx] = { ...updated[idx], customLabel: val };
                                return updated;
                              });
                            }}
                            className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-900 bg-slate-50 focus:bg-white focus:border-indigo-600 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-indigo-200 rounded-lg p-4 text-center">
                  <Camera className="w-6 h-6 text-indigo-400 mx-auto mb-1" />
                  <p className="text-[11px] text-slate-600 font-bold">No photos attached yet.</p>
                  <p className="text-[10px] text-slate-500">Tap &quot;Attach Photos&quot; above to snap or upload Before, After, and Data Plate photos.</p>
                </div>
              )}
            </div>
          )}

          {/* JOB PHOTOS & DOCUMENTATION ATTACHMENTS GRID */}
          {jobPhotos.length > 0 && (
            <div className="mt-3 border border-slate-200 rounded-xl p-3 bg-white">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 mb-2 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Uploaded Job Photos ({jobPhotos.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {jobPhotos.map((photo, pIdx) => (
                  <div key={pIdx} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <div className="h-28 w-full bg-slate-900 overflow-hidden">
                      <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-1.5 text-center bg-white border-t border-slate-100">
                      <span className="inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-full">
                        {photo.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div className="mt-2 text-center text-[8px] text-slate-600 uppercase tracking-widest font-bold leading-tight">
            <div>Thank you for your business! Submit completed document digitally or to office staff for digital filing.</div>
            <div className="text-[7.5px] text-slate-700 font-black mt-0.5">(Required: Submit before &amp; after photos for each unit with this form).</div>
          </div>

        </div>
      ))}
    </div>
  );
};
