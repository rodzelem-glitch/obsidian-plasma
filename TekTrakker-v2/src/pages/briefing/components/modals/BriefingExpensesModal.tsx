import React, { useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import Textarea from '../../../../components/ui/Textarea';
import Toggle from '../../../../components/ui/Toggle';
import { useLanguage } from '../../../../context/LanguageContext';
import { useAppContext } from '../../../../context/AppContext';
import { 
  CreditCard, 
  Fuel, 
  Wrench, 
  Package, 
  Plus, 
  Calendar, 
  Receipt,
  Camera as CameraIcon,
  CheckCircle2,
  Gauge,
  Car,
  Paperclip,
  Eye,
  Image as ImageIcon,
  Edit3,
  Trash2,
  Check,
  X,
  Building2,
  UserCheck,
  ExternalLink
} from 'lucide-react';
import showToast from '../../../../lib/toast';
import { db } from '../../../../lib/firebase';
import { cleanUndefinedFields } from '../../../../lib/utils';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { detectFileType } from '../../../../lib/fileViewerHelper';
import WebCameraModal from '../WebCameraModal';
import { uploadFileToStorage } from '../../../../lib/storageService';
import { parseReceiptImage } from '../../../../utils/receiptOcr';
import { globalConfirm } from '../../../../lib/globalConfirm';

interface BriefingExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BriefingExpensesModal: React.FC<BriefingExpensesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  const { state, dispatch } = useAppContext();
  const { currentUser: user, vehicleLogs } = state;

  const [category, setCategory] = useState<'Fuel' | 'Maintenance' | 'Parts & Supplies' | 'Tolls & Parking' | 'Miscellaneous'>('Fuel');
  const [cost, setCost] = useState('');
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [isCompanyVehicleRelated, setIsCompanyVehicleRelated] = useState(true);
  const [currentMileage, setCurrentMileage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Receipt capture states
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [capturedReceiptData, setCapturedReceiptData] = useState<string | null>(null);
  const [isWebCameraOpen, setIsWebCameraOpen] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [isParsingReceipt, setIsParsingReceipt] = useState(false);

  // Edit Expense states
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<'Fuel' | 'Maintenance' | 'Parts & Supplies' | 'Tolls & Parking' | 'Miscellaneous'>('Fuel');
  const [editCost, setEditCost] = useState('');
  const [editTax, setEditTax] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsCompanyVehicle, setEditIsCompanyVehicle] = useState(true);
  const [editCurrentMileage, setEditCurrentMileage] = useState('');
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const [editCapturedReceiptData, setEditCapturedReceiptData] = useState<string | null>(null);
  const [editExistingReceiptUrl, setEditExistingReceiptUrl] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isEditWebCameraOpen, setIsEditWebCameraOpen] = useState(false);

  const handleStartEditExpense = (log: any) => {
    setEditingLogId(log.id);
    const cat = log.category || (log.type === 'Fuel' ? 'Fuel' : log.type === 'Maintenance' ? 'Maintenance' : 'Fuel');
    setEditCategory(cat);
    setEditCost(log.cost !== undefined ? String(log.cost) : '');
    setEditTax(log.tax !== undefined && log.tax !== null ? String(log.tax) : '');
    setEditNotes(log.notes || '');
    setEditIsCompanyVehicle(log.isCompanyVehicle ?? true);
    const logMileage = log.currentMileage || log.mileage;
    setEditCurrentMileage(logMileage !== undefined && logMileage !== null ? String(logMileage) : '');
    setEditReceiptFile(null);
    setEditCapturedReceiptData(null);
    setEditExistingReceiptUrl(log.receiptUrl || log.receiptData || null);
  };

  const handleSaveEditExpense = async (log: any) => {
    const costNum = parseFloat(editCost);
    if (isNaN(costNum) || costNum <= 0) {
      showToast.warn(t("Please enter a valid expense amount ($)."));
      return;
    }

    if (editIsCompanyVehicle) {
      const milesNum = parseFloat(editCurrentMileage);
      if (isNaN(milesNum) || milesNum <= 0) {
        showToast.warn(t("Current vehicle mileage is required for Company Vehicle expenses."));
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      let finalReceiptUrl: string | undefined = editExistingReceiptUrl || undefined;

      if (editCapturedReceiptData) {
        const path = `organizations/${user?.organizationId}/users/${user?.id}/receipts/${Date.now()}_capture.jpg`;
        finalReceiptUrl = await uploadFileToStorage(path, editCapturedReceiptData);
      } else if (editReceiptFile) {
        const safeName = editReceiptFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const path = `organizations/${user?.organizationId}/users/${user?.id}/receipts/${Date.now()}_${safeName}`;
        finalReceiptUrl = await uploadFileToStorage(path, editReceiptFile);
      }

      const milesNum = parseFloat(editCurrentMileage);
      const taxNum = parseFloat(editTax);
      const updatedFields: any = {
        type: (editCategory === 'Fuel' ? 'Fuel' : 'Maintenance'),
        category: editCategory,
        cost: costNum,
        tax: !isNaN(taxNum) && taxNum >= 0 ? taxNum : undefined,
        isCompanyVehicle: editIsCompanyVehicle,
        mileage: !isNaN(milesNum) && milesNum > 0 ? milesNum : undefined,
        currentMileage: !isNaN(milesNum) && milesNum > 0 ? milesNum : undefined,
        notes: editNotes.trim() || undefined,
        receiptUrl: finalReceiptUrl || undefined,
      };

      await db.collection('vehicleLogs').doc(log.id).update(cleanUndefinedFields(updatedFields));
      dispatch({
        type: 'UPDATE_VEHICLE_LOG',
        payload: { ...log, ...updatedFields },
      });
      showToast.success(t("Expense updated successfully!"));
      setEditingLogId(null);
    } catch (err: any) {
      console.error("Failed to update expense:", err);
      showToast.error(t("Failed to update expense: ") + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteExpense = async (logId: string) => {
    if (await globalConfirm(t("Are you sure you want to delete this expense record?"), t("Delete Expense Entry"), t("Delete Entry"), t("Cancel"))) {
      try {
        await db.collection('vehicleLogs').doc(logId).delete();
        dispatch({ type: 'DELETE_VEHICLE_LOG', payload: logId });
        showToast.success(t("Expense record deleted successfully!"));
      } catch (err: any) {
        console.error("Failed to delete expense:", err);
        showToast.error(t("Failed to delete expense: ") + err.message);
      }
    }
  };

  const handleToggleExpenseVehicleType = async (log: any) => {
    try {
      const newClassification = !(log.isCompanyVehicle ?? true);
      await db.collection('vehicleLogs').doc(log.id).update({
        isCompanyVehicle: newClassification,
      });
      dispatch({
        type: 'UPDATE_VEHICLE_LOG',
        payload: { ...log, isCompanyVehicle: newClassification },
      });
      showToast.success(newClassification ? t("Marked as Company Vehicle") : t("Marked as Personal Vehicle"));
    } catch (err: any) {
      console.error("Failed to toggle vehicle type:", err);
      showToast.error(t("Failed to update classification: ") + err.message);
    }
  };

  // Scan & Auto-Extract Receipt OCR Data
  const scanAndParseReceipt = async (input: File | string) => {
    setIsParsingReceipt(true);
    try {
      const parsed = await parseReceiptImage(input);
      if (parsed.cost) {
        setCost(parsed.cost);
        showToast.success(`${t("Extracted Amount:")} $${parsed.cost}`);
      }
      if (parsed.tax) {
        setTax(parsed.tax);
        showToast.info(`${t("Extracted Sales Tax:")} $${parsed.tax}`);
      }
      if (parsed.vendor && !notes) {
        setNotes(parsed.vendor);
      }
      if (parsed.category) {
        setCategory(parsed.category);
      }
    } catch (err) {
      console.warn("Receipt OCR skipped:", err);
    } finally {
      setIsParsingReceipt(false);
    }
  };

  // Handle Save Expense Log
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const costNum = parseFloat(cost);
    if (isNaN(costNum) || costNum <= 0) {
      showToast.warn(t("Please enter a valid expense amount ($)."));
      return;
    }

    if (isCompanyVehicleRelated) {
      const milesNum = parseFloat(currentMileage);
      if (isNaN(milesNum) || milesNum <= 0) {
        showToast.warn(t("Current vehicle mileage is required for Company Vehicle expenses."));
        return;
      }
    }

    setIsSaving(true);
    try {
      let receiptUrlValue: string | undefined = undefined;

      if (capturedReceiptData) {
        const path = `organizations/${user.organizationId}/users/${user.id}/receipts/${Date.now()}_capture.jpg`;
        receiptUrlValue = await uploadFileToStorage(path, capturedReceiptData);
      } else if (receiptFile) {
        const safeName = receiptFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const path = `organizations/${user.organizationId}/users/${user.id}/receipts/${Date.now()}_${safeName}`;
        receiptUrlValue = await uploadFileToStorage(path, receiptFile);
      }

      const logId = `vlog_${Date.now()}`;
      const milesNum = parseFloat(currentMileage);
      const taxNum = parseFloat(tax);
      const subtotalCalc = !isNaN(taxNum) && taxNum >= 0 ? Math.max(0, costNum - taxNum) : costNum;
      const vendorName = notes.trim() ? (notes.trim().split('\n')[0]) : category;

      const newLog = {
        id: logId,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        organizationId: user.organizationId,
        date: new Date().toISOString(),
        type: (category === 'Fuel' ? 'Fuel' : category === 'Maintenance' ? 'Maintenance' : 'Maintenance') as any,
        category,
        cost: costNum,
        amount: costNum,
        tax: !isNaN(taxNum) && taxNum >= 0 ? taxNum : undefined,
        taxAmount: !isNaN(taxNum) && taxNum >= 0 ? taxNum : undefined,
        subtotal: subtotalCalc,
        vendor: vendorName,
        isCompanyVehicle: isCompanyVehicleRelated,
        mileage: !isNaN(milesNum) && milesNum > 0 ? milesNum : undefined,
        currentMileage: !isNaN(milesNum) && milesNum > 0 ? milesNum : undefined,
        notes: notes.trim() || undefined,
        receiptUrl: receiptUrlValue || undefined,
        receiptUrls: receiptUrlValue ? [receiptUrlValue] : [],
      };

      await db.collection('vehicleLogs').doc(logId).set(cleanUndefinedFields(newLog));
      dispatch({ type: 'ADD_VEHICLE_LOG', payload: newLog });
      showToast.success(t("Expense logged successfully!"));

      // Reset form
      setCost('');
      setTax('');
      setNotes('');
      setCurrentMileage('');
      setReceiptFile(null);
      setCapturedReceiptData(null);
      onClose();
    } catch (err: any) {
      console.error("Failed to save expense:", err);
      showToast.error(t("Failed to log expense: ") + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // User expense history (Fuel, Maintenance, Parts)
  const userExpenses = (Array.isArray(vehicleLogs) ? vehicleLogs : [])
    .filter((l) => l.userId === user?.id && (l.type === 'Fuel' || l.type === 'Maintenance' || (l as any).category))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <CreditCard className="text-primary-600 shrink-0" size={24} />
          <div>
            <h2 className="font-extrabold text-base md:text-lg">{t("Expenses & Receipt Logger")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {t("Log fuel, vehicle maintenance, job parts, and receipt documentation.")}
            </p>
          </div>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6 pb-4">
        
        {/* Expense Logger Form */}
        <form onSubmit={handleSaveExpense} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Receipt size={16} className="text-primary-600" />
            {t("Log New Business Expense")}
          </span>

          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Car size={16} className="text-primary-600" />
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                {t("Related to Company Vehicle?")}
              </span>
            </div>
            <Toggle
              label=""
              enabled={isCompanyVehicleRelated}
              onChange={(val) => {
                setIsCompanyVehicleRelated(val);
                if (!val) setCurrentMileage('');
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">{t("Expense Category")}</label>
              <Select
                value={category}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setCategory(val);
                  const isVehicleCategory = val === 'Fuel' || val === 'Maintenance';
                  setIsCompanyVehicleRelated(isVehicleCategory);
                  if (!isVehicleCategory) {
                    setCurrentMileage('');
                  }
                }}
                className="text-xs font-bold"
              >
                <option value="Fuel">⛽ Fuel & Gas</option>
                <option value="Maintenance">🔧 Vehicle Maintenance & Oil</option>
                <option value="Parts & Supplies">📦 Job Parts & Supplies</option>
                <option value="Tolls & Parking">🅿️ Tolls & Parking</option>
                <option value="Miscellaneous">💳 Other Business Expense</option>
              </Select>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">{t("Total Cost ($ USD)")}</label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 64.50"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="font-mono font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">{t("Sales Tax ($ USD)")}</label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 5.16"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {isCompanyVehicleRelated && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Gauge size={14} />
                  {t("Current Vehicle Odometer Reading")} *
                </label>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {t("Required Field")}
                </span>
              </div>
              <Input
                type="number"
                placeholder={t("Enter current mileage (e.g. 104089)")}
                value={currentMileage}
                onChange={(e) => setCurrentMileage(e.target.value)}
                className="font-mono font-bold text-xs bg-white dark:bg-slate-900 border-amber-500/40"
              />
              <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 italic">
                {t("Odometer reading is required when logging expenses for company vehicles.")}
              </p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">{t("Description & Vendor Notes")}</label>
            <Input
              type="text"
              placeholder={t("e.g. Shell Gas Station or Home Depot Parts...")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Receipt Attachment Section */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-[10px] font-extrabold uppercase text-slate-400">
              {t("Attach Receipt Image / Photo")}
            </label>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    const isNative = (window as any).Capacitor?.isNativePlatform?.();
                    if (isNative) {
                      const image = await Camera.getPhoto({
                        quality: 60,
                        allowEditing: true,
                        resultType: CameraResultType.Base64,
                        source: CameraSource.Camera
                      });
                      if (image.base64String) {
                        const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
                        setCapturedReceiptData(dataUrl);
                        showToast.success(t("Receipt photo captured!"));
                        scanAndParseReceipt(dataUrl);
                      }
                    } else {
                      setIsWebCameraOpen(true);
                    }
                  } catch (e) {
                    setIsWebCameraOpen(true);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold"
              >
                <CameraIcon size={14} />
                {t("Take Photo")}
              </Button>

              <div className="relative flex-1">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    if (files.length > 0) {
                      setReceiptFile(files[0]);
                      setCapturedReceiptData(null);
                      files.forEach(f => scanAndParseReceipt(f));
                      showToast.info(t(`Selected ${files.length} receipt photo(s). OCR scanning vendor & amount...`));
                    }
                  }}
                  className="hidden"
                  id="briefing-receipt-upload"
                  aria-label="Upload Receipts"
                  title="Upload Receipts"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const isNative = (window as any).Capacitor?.isNativePlatform?.();
                      if (isNative) {
                        const result = await Camera.pickImages({ quality: 80, limit: 0 });
                        if (result.photos && result.photos.length > 0) {
                          const filePromises = result.photos.map(async (p, idx) => {
                            const res = await fetch(p.webPath);
                            const blob = await res.blob();
                            return new File([blob], `receipt_${Date.now()}_${idx}.jpg`, { type: 'image/jpeg' });
                          });
                          const converted = await Promise.all(filePromises);
                          setReceiptFile(converted[0]);
                          setCapturedReceiptData(null);
                          converted.forEach(f => scanAndParseReceipt(f));
                          showToast.info(t(`Selected ${converted.length} receipt photo(s). OCR scanning vendor & amount...`));
                          return;
                        }
                      }
                    } catch (err: any) {
                      const msg = (err?.message || '').toLowerCase();
                      if (msg.includes('cancel') || msg.includes('dismiss')) return;
                    }
                    document.getElementById('briefing-receipt-upload')?.click();
                  }}
                  className="w-full h-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold"
                >
                  <Paperclip size={14} />
                  {t("Upload File")}
                </Button>
              </div>
            </div>

            {isParsingReceipt && (
              <p className="text-[11px] font-bold text-primary-600 dark:text-primary-400 animate-pulse flex items-center gap-1.5">
                🤖 {t("AI Scanner parsing receipt total amount & vendor...")}
              </p>
            )}

            {(receiptFile || capturedReceiptData) && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                <span className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                  {receiptFile ? receiptFile.name : t("Captured Receipt Photo")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptFile(null);
                    setCapturedReceiptData(null);
                  }}
                  className="text-rose-600 hover:underline text-[10px] uppercase font-bold shrink-0 ml-2"
                >
                  {t("Remove")}
                </button>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSaving || !cost || parseFloat(cost) <= 0}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5"
          >
            <Plus size={16} />
            {isSaving ? t("Logging & Uploading...") : t("Save Expense Record")}
          </Button>
        </form>

        {/* Expense Log History List */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar size={14} />
            {t("Recent Expenses Logged")} ({userExpenses.length})
          </h3>

          {userExpenses.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 text-xs">
              {userExpenses.slice(0, 15).map((log) => {
                const logMileage = (log as any).currentMileage || (log as any).mileage;
                const logReceiptUrl = (log as any).receiptUrl || (log as any).receiptData;
                const isCompanyVehicleStatus = log.isCompanyVehicle ?? true;
                const isEditingThisLog = editingLogId === log.id;

                return (
                  <div key={log.id} className="p-3.5 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {(log as any).category || log.type} • {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {log.notes || t("Business Expense")}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {logMileage && (
                            <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1">
                              <Gauge size={11} />
                              Odometer: {Number(logMileage).toLocaleString()} mi
                            </span>
                          )}
                          {logReceiptUrl && (
                            <button
                              type="button"
                              onClick={() => setViewingReceiptUrl(logReceiptUrl)}
                              className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 px-2 py-0.5 rounded-md hover:underline flex items-center gap-1 border border-primary-200 dark:border-primary-800"
                            >
                              <Paperclip size={10} />
                              {t("View Receipt")}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono block">
                          ${log.cost ? Number(log.cost).toFixed(2) : '0.00'}
                        </span>
                        {log.tax !== undefined && log.tax > 0 && (
                          <span className="text-[10px] text-slate-500 font-mono block font-semibold">
                            Tax: ${Number(log.tax).toFixed(2)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleExpenseVehicleType(log)}
                          title={t("Click to toggle classification (Company / Personal Vehicle)")}
                          className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border transition-all flex items-center gap-1 cursor-pointer hover:scale-105 ${
                            isCompanyVehicleStatus
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {isCompanyVehicleStatus ? <Building2 size={10} /> : <UserCheck size={10} />}
                          {isCompanyVehicleStatus ? t("Company Vehicle") : t("Personal Vehicle")}
                        </button>
                      </div>
                    </div>

                    {/* Inline Expense Editor */}
                    {isEditingThisLog ? (
                      <div className="pt-2 p-3.5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>{t("Edit Expense Record")}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 uppercase">{t("Company Vehicle?")}</span>
                            <Toggle label="" enabled={editIsCompanyVehicle} onChange={setEditIsCompanyVehicle} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Category")}</label>
                            <Select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value as any)}
                              className="text-xs bg-white dark:bg-slate-900 font-bold"
                            >
                              <option value="Fuel">⛽ {t("Fuel")}</option>
                              <option value="Maintenance">🔧 {t("Maintenance")}</option>
                              <option value="Parts & Supplies">📦 {t("Parts & Supplies")}</option>
                              <option value="Tolls & Parking">🅿️ {t("Tolls & Parking")}</option>
                              <option value="Miscellaneous">💳 {t("Miscellaneous")}</option>
                            </Select>
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Cost ($)")}</label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              className="text-xs font-mono font-bold bg-white dark:bg-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Sales Tax ($)")}</label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={editTax}
                              onChange={(e) => setEditTax(e.target.value)}
                              className="text-xs font-mono bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>

                        {editIsCompanyVehicle && (
                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Current Odometer Reading (mi)")}</label>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="e.g. 45200"
                              value={editCurrentMileage}
                              onChange={(e) => setEditCurrentMileage(e.target.value)}
                              className="text-xs font-mono bg-white dark:bg-slate-900"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Notes / Vendor")}</label>
                          <Input
                            type="text"
                            placeholder={t("Expense notes or vendor name...")}
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="text-xs bg-white dark:bg-slate-900"
                          />
                        </div>

                        {/* Receipt Document Controls */}
                        <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <label className="block text-[9px] font-extrabold uppercase text-slate-400">{t("Receipt Document")}</label>
                          
                          {(editExistingReceiptUrl || editReceiptFile || editCapturedReceiptData) ? (
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                              <span className="flex items-center gap-1.5 truncate">
                                <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                                {editReceiptFile ? editReceiptFile.name : editCapturedReceiptData ? t("New Receipt Photo Captured") : t("Existing Receipt Attached")}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditReceiptFile(null);
                                  setEditCapturedReceiptData(null);
                                  setEditExistingReceiptUrl(null);
                                }}
                                className="text-rose-600 hover:underline text-[10px] uppercase font-bold shrink-0 ml-2"
                              >
                                {t("Remove")}
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={async () => {
                                  try {
                                    const isNative = (window as any).Capacitor?.isNativePlatform?.();
                                    if (isNative) {
                                      const image = await Camera.getPhoto({
                                        quality: 60,
                                        allowEditing: true,
                                        resultType: CameraResultType.Base64,
                                        source: CameraSource.Camera
                                      });
                                      if (image.base64String) {
                                        const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
                                        setEditCapturedReceiptData(dataUrl);
                                        showToast.success(t("Receipt photo captured!"));
                                      }
                                    } else {
                                      setIsEditWebCameraOpen(true);
                                    }
                                  } catch (e) {
                                    setIsEditWebCameraOpen(true);
                                  }
                                }}
                                className="flex-1 py-1.5 text-xs flex items-center justify-center gap-1"
                              >
                                <CameraIcon size={12} />
                                {t("Take Photo")}
                              </Button>

                              <div className="relative flex-1">
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => {
                                    const f = e.target.files ? e.target.files[0] : null;
                                    setEditReceiptFile(f);
                                    setEditCapturedReceiptData(null);
                                  }}
                                  className="hidden"
                                  id="edit-expense-file-upload"
                                />
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => document.getElementById('edit-expense-file-upload')?.click()}
                                  className="w-full py-1.5 text-xs flex items-center justify-center gap-1"
                                >
                                  <Paperclip size={12} />
                                  {t("Upload File")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setEditingLogId(null)}
                            className="text-xs text-slate-400 px-3 py-1.5"
                          >
                            {t("Cancel")}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleSaveEditExpense(log)}
                            disabled={isSavingEdit}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-xl flex items-center gap-1"
                          >
                            <Check size={14} />
                            {isSavingEdit ? t("Saving...") : t("Save Changes")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Log ID: {log.id}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditExpense(log)}
                            className="text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1"
                          >
                            <Edit3 size={11} />
                            {t("Edit")}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(log.id)}
                            className="text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all flex items-center gap-1"
                            title={t("Delete Expense Entry")}
                          >
                            <Trash2 size={11} />
                            {t("Delete")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-slate-400 text-xs italic">
              {t("No expenses logged yet.")}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="primary" onClick={onClose} className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold text-xs px-5 py-2.5 rounded-xl">
            {t("Close")}
          </Button>
        </div>
      </div>

      {/* Web Camera Modal Integrations */}
      {isWebCameraOpen && (
        <WebCameraModal
          isOpen={isWebCameraOpen}
          onClose={() => setIsWebCameraOpen(false)}
          onCapture={(dataUrl) => {
            setCapturedReceiptData(dataUrl);
            setIsWebCameraOpen(false);
            showToast.success(t("Receipt photo captured!"));
            scanAndParseReceipt(dataUrl);
          }}
        />
      )}

      {isEditWebCameraOpen && (
        <WebCameraModal
          isOpen={isEditWebCameraOpen}
          onClose={() => setIsEditWebCameraOpen(false)}
          onCapture={(dataUrl) => {
            setEditCapturedReceiptData(dataUrl);
            setIsEditWebCameraOpen(false);
            showToast.success(t("Receipt photo captured!"));
          }}
        />
      )}

      {/* Receipt Image Viewer Modal */}
      {viewingReceiptUrl && (() => {
        const fileInfo = detectFileType(viewingReceiptUrl);
        return (
          <Modal isOpen={!!viewingReceiptUrl} onClose={() => setViewingReceiptUrl(null)} title={t("Receipt Document Viewer")} size="xl">
            <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-xl flex justify-center max-h-[70vh] overflow-auto min-h-[400px] items-center">
              {fileInfo.isImage ? (
                <img src={viewingReceiptUrl} alt="Receipt" className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-md" />
              ) : fileInfo.isPdf ? (
                <iframe src={viewingReceiptUrl} className="w-full h-[60vh] border-0 bg-white rounded-lg" title="Receipt PDF" />
              ) : fileInfo.isHtml ? (
                <iframe src={viewingReceiptUrl} className="w-full h-[60vh] border-0 bg-white rounded-lg" title="Receipt Document" />
              ) : fileInfo.googleDocsViewerUrl ? (
                <iframe src={fileInfo.googleDocsViewerUrl} className="w-full h-[60vh] border-0 bg-white rounded-lg" title="Receipt Document" />
              ) : (
                <img src={viewingReceiptUrl} alt="Receipt" className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-md" />
              )}
            </div>
            <div className="mt-4 flex justify-between items-center">
              <a
                href={viewingReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
              <Button onClick={() => setViewingReceiptUrl(null)}>{t("Close")}</Button>
            </div>
          </Modal>
        );
      })()}
    </Modal>
  );
};

export default BriefingExpensesModal;
