import React, { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Toggle from '../../../../components/ui/Toggle';
import Textarea from '../../../../components/ui/Textarea';
import { useLanguage } from '../../../../context/LanguageContext';
import { useAppContext } from '../../../../context/AppContext';
import { 
  Navigation, 
  MapPin, 
  Plus, 
  Calendar, 
  FileText,
  Car,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Check,
  Trash2,
  X,
  Building2,
  UserCheck
} from 'lucide-react';
import showToast from '../../../../lib/toast';
import { db } from '../../../../lib/firebase';
import { cleanUndefinedFields } from '../../../../lib/utils';
import { getCurrentLocation } from '../../../../lib/geolocation';
import { globalConfirm } from '../../../../lib/globalConfirm';

interface BriefingMileageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BriefingMileageModal: React.FC<BriefingMileageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  const { state, dispatch } = useAppContext();
  const { currentUser: user, vehicleLogs } = state;

  // Check if employee is assigned a company vehicle
  const hasCompanyVehicle = React.useMemo(() => {
    if (!user?.id || !state.vehicles) return false;
    return state.vehicles.some((v: any) =>
      v.assignedUserId === user.id ||
      v.currentDriverId === user.id ||
      v.assignedTechId === user.id ||
      v.assignedEmployeeId === user.id ||
      v.id === (user as any).assignedVehicleId ||
      v.id === (user as any).companyVehicleId
    );
  }, [state.vehicles, user]);

  const [startMiles, setStartMiles] = useState('');
  const [endMiles, setEndMiles] = useState('');
  const [isCompanyVehicle, setIsCompanyVehicle] = useState(hasCompanyVehicle);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editMilesText, setEditMilesText] = useState('');
  const [editStartMilesText, setEditStartMilesText] = useState('');
  const [editEndMilesText, setEditEndMilesText] = useState('');
  const [editNotesText, setEditNotesText] = useState('');
  const [editIsCompanyVehicle, setEditIsCompanyVehicle] = useState(false);
  const [isSavingPurpose, setIsSavingPurpose] = useState(false);

  useEffect(() => {
    setIsCompanyVehicle(hasCompanyVehicle);
  }, [hasCompanyVehicle]);

  const handleStartEdit = (log: any) => {
    setEditingLogId(log.id);
    const currentMilesVal = log.miles ?? log.mileage ?? (log.endMileage && log.startMileage ? log.endMileage - log.startMileage : '');
    setEditMilesText(currentMilesVal ? String(currentMilesVal) : '');
    setEditStartMilesText(log.startMileage ? String(log.startMileage) : (log.startMiles ? String(log.startMiles) : ''));
    setEditEndMilesText(log.endMileage ? String(log.endMileage) : (log.endMiles ? String(log.endMiles) : ''));
    setEditNotesText(log.notes || log.businessPurpose || '');
    setEditIsCompanyVehicle(log.isCompanyVehicle ?? hasCompanyVehicle);
  };

  const handleSaveFullEdit = async (log: any) => {
    const parsedMiles = parseFloat(editMilesText);
    const parsedStart = parseFloat(editStartMilesText);
    const parsedEnd = parseFloat(editEndMilesText);

    let finalMiles = !isNaN(parsedMiles) && parsedMiles > 0 ? parsedMiles : 0;
    if (finalMiles === 0 && !isNaN(parsedStart) && !isNaN(parsedEnd) && parsedEnd >= parsedStart) {
      finalMiles = parsedEnd - parsedStart;
    }

    if (finalMiles <= 0) {
      showToast.warn(t("Please enter valid miles or odometer readings."));
      return;
    }

    setIsSavingPurpose(true);
    try {
      const updatedFields: any = {
        miles: finalMiles,
        mileage: finalMiles,
        isCompanyVehicle: editIsCompanyVehicle,
        notes: editNotesText.trim(),
        businessPurpose: editNotesText.trim(),
        auditFlagged: false,
      };
      if (!isNaN(parsedStart)) updatedFields.startMileage = parsedStart;
      if (!isNaN(parsedEnd)) updatedFields.endMileage = parsedEnd;

      await db.collection('vehicleLogs').doc(log.id).update(updatedFields);
      dispatch({
        type: 'UPDATE_VEHICLE_LOG',
        payload: { ...log, ...updatedFields },
      });
      showToast.success(t("Mileage log updated successfully!"));
      setEditingLogId(null);
    } catch (err: any) {
      console.error("Failed to update mileage log:", err);
      showToast.error(t("Failed to update log: ") + err.message);
    } finally {
      setIsSavingPurpose(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (await globalConfirm(t("Are you sure you want to delete this mileage log entry?"), t("Delete Mileage Log"), t("Delete Entry"), t("Cancel"))) {
      try {
        await db.collection('vehicleLogs').doc(logId).delete();
        dispatch({ type: 'DELETE_VEHICLE_LOG', payload: logId });
        showToast.success(t("Mileage log deleted successfully!"));
      } catch (err: any) {
        console.error("Failed to delete log:", err);
        showToast.error(t("Failed to delete log: ") + err.message);
      }
    }
  };

  const handleToggleVehicleType = async (log: any) => {
    try {
      const newClassification = !(log.isCompanyVehicle ?? hasCompanyVehicle);
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

  // Auto-calculated total miles
  const totalMiles = React.useMemo(() => {
    const s = parseFloat(startMiles);
    const e = parseFloat(endMiles);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      return (e - s).toFixed(1);
    }
    return '0.0';
  }, [startMiles, endMiles]);

  // User mileage history (supports array or map structure)
  const userLogs = React.useMemo(() => {
    if (!user?.id || !vehicleLogs) return [];
    let list: any[] = [];
    if (Array.isArray(vehicleLogs)) {
      list = vehicleLogs.filter((l: any) => l && l.userId === user.id);
    } else if (typeof vehicleLogs === 'object') {
      if (Array.isArray((vehicleLogs as any)[user.id])) {
        list = (vehicleLogs as any)[user.id];
      } else {
        list = Object.values(vehicleLogs).flat().filter((l: any) => l && l.userId === user.id);
      }
    }
    return list
      .filter((l: any) => l && (l.type === 'Mileage' || typeof l.miles === 'number' || typeof l.mileage === 'number' || l.startMileage))
      .sort((a, b) => new Date(b.date || b.timestamp || b.clockOut || 0).getTime() - new Date(a.date || a.timestamp || a.clockOut || 0).getTime());
  }, [vehicleLogs, user?.id]);

  // Detect active uncompleted trip (startMileage set, endMileage missing/0)
  const activeTrip = React.useMemo(() => {
    return userLogs.find((l: any) => l.startMileage && (!l.endMileage || l.endMileage === 0));
  }, [userLogs]);

  // Handle Save Mileage Log (Supports Start Trip, End Trip, or Completed Trip)
  const handleSaveMileage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsedStart = parseFloat(startMiles);
    const parsedEnd = parseFloat(endMiles);
    const hasStart = !isNaN(parsedStart) && parsedStart > 0;
    const hasEnd = !isNaN(parsedEnd) && parsedEnd > 0;

    // Case 1: Ending an active trip
    if (activeTrip && hasEnd) {
      if (parsedEnd < (activeTrip.startMileage || 0)) {
        showToast.warn(t("Ending odometer must be greater than or equal to starting odometer."));
        return;
      }
      setIsSaving(true);
      try {
        let endLoc = null;
        try {
          const coords = await getCurrentLocation();
          endLoc = { lat: coords.latitude, lng: coords.longitude };
        } catch (err) {
          console.warn("End location capture skipped:", err);
        }

        const calculatedDist = parsedEnd - (activeTrip.startMileage || 0);
        const updatedTrip = {
          ...activeTrip,
          endMileage: parsedEnd,
          miles: calculatedDist,
          mileage: calculatedDist,
          endTime: new Date().toISOString(),
          endLocation: endLoc || undefined,
          notes: notes.trim() ? (activeTrip.notes ? `${activeTrip.notes} | ${notes.trim()}` : notes.trim()) : activeTrip.notes,
        };

        await db.collection('vehicleLogs').doc(activeTrip.id).update(cleanUndefinedFields(updatedTrip));
        dispatch({ type: 'UPDATE_VEHICLE_LOG', payload: updatedTrip });
        showToast.success(t("Trip completed and ending mileage saved!"));

        setStartMiles('');
        setEndMiles('');
        setNotes('');
        onClose();
      } catch (err: any) {
        console.error("Failed to complete trip:", err);
        showToast.error(t("Failed to complete trip: ") + err.message);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Case 2: Starting a new trip (Start Miles provided, no End Miles)
    if (hasStart && !hasEnd) {
      setIsSaving(true);
      try {
        let startLoc = null;
        try {
          const coords = await getCurrentLocation();
          startLoc = { lat: coords.latitude, lng: coords.longitude };
        } catch (err) {
          console.warn("Start location capture skipped:", err);
        }

        const logId = `vlog_${Date.now()}`;
        const newTripLog = {
          id: logId,
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          organizationId: user.organizationId,
          date: new Date().toISOString(),
          startTime: new Date().toISOString(),
          type: 'Mileage' as const,
          startMileage: parsedStart,
          endMileage: undefined,
          miles: 0,
          isCompanyVehicle,
          notes: notes.trim() || undefined,
          startLocation: startLoc || undefined,
          location: startLoc || undefined,
        };

        await db.collection('vehicleLogs').doc(logId).set(cleanUndefinedFields(newTripLog));
        dispatch({ type: 'ADD_VEHICLE_LOG', payload: newTripLog });
        showToast.success(t("Trip started! Starting mileage and geolocation recorded."));

        setStartMiles('');
        setEndMiles('');
        setNotes('');
        onClose();
      } catch (err: any) {
        console.error("Failed to start trip:", err);
        showToast.error(t("Failed to start trip: ") + err.message);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Case 3: Both Start and End Miles provided (Full Trip Entry)
    if (hasStart && hasEnd) {
      if (parsedEnd < parsedStart) {
        showToast.warn(t("Ending odometer must be greater than starting odometer."));
        return;
      }

      const calculatedMiles = parsedEnd - parsedStart;
      setIsSaving(true);
      try {
        let locationData = null;
        try {
          const coords = await getCurrentLocation();
          locationData = { lat: coords.latitude, lng: coords.longitude };
        } catch (err) {
          console.warn("Location capture skipped:", err);
        }

        const logId = `vlog_${Date.now()}`;
        const newLog = {
          id: logId,
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          organizationId: user.organizationId,
          date: new Date().toISOString(),
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          type: 'Mileage' as const,
          miles: calculatedMiles,
          mileage: calculatedMiles,
          startMileage: parsedStart,
          endMileage: parsedEnd,
          isCompanyVehicle,
          notes: notes.trim() || undefined,
          location: locationData,
          startLocation: locationData,
          endLocation: locationData,
        };

        await db.collection('vehicleLogs').doc(logId).set(cleanUndefinedFields(newLog));
        dispatch({ type: 'ADD_VEHICLE_LOG', payload: newLog });
        showToast.success(t("Mileage log saved successfully!"));

        setStartMiles('');
        setEndMiles('');
        setNotes('');
        onClose();
      } catch (err: any) {
        console.error("Failed to save mileage:", err);
        showToast.error(t("Failed to log mileage: ") + err.message);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    showToast.warn(t("Please enter starting odometer to start a trip, or ending odometer to complete active trip."));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Navigation className="text-primary-600 shrink-0" size={24} />
          <div>
            <h2 className="font-extrabold text-base md:text-lg">{t("IRS Mileage Tracker & Trip Logs")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {t("Log odometer readings, vehicle classification, and mileage history.")}
            </p>
          </div>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6 pb-4">
        
        {/* Active Trip Banner if ongoing trip exists */}
        {activeTrip && (
          <div className="p-4 bg-sky-500/10 border-2 border-sky-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping"></span>
                <span className="font-extrabold text-xs uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  {t("Trip Currently In Progress")}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1">
                {t("Started at Odometer:")} <strong className="font-mono text-sky-600 dark:text-sky-400">{activeTrip.startMileage} mi</strong> {activeTrip.notes ? `(${activeTrip.notes})` : ''}
              </p>
            </div>
            <span className="text-[10px] font-bold bg-sky-500/20 text-sky-800 dark:text-sky-200 px-3 py-1 rounded-full border border-sky-500/30 shrink-0">
              {t("Enter Ending Odometer Below to Complete")}
            </span>
          </div>
        )}

        {/* Mileage Form */}
        <form onSubmit={handleSaveMileage} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Car size={16} className="text-primary-600" />
              {activeTrip ? t("Complete Active Trip") : t("Log Odometer & Mileage")}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{t("Company Vehicle?")}</span>
              <Toggle label="" enabled={isCompanyVehicle} onChange={setIsCompanyVehicle} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">
                {t("Odometer Start")} {activeTrip ? `(${t("Recorded")}: ${activeTrip.startMileage})` : ''}
              </label>
              <Input
                type="number"
                placeholder={activeTrip ? String(activeTrip.startMileage) : "e.g. 45200"}
                value={startMiles}
                onChange={(e) => setStartMiles(e.target.value)}
                className="font-mono font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">{t("Odometer End")}</label>
              <Input
                type="number"
                placeholder="e.g. 45248"
                value={endMiles}
                onChange={(e) => setEndMiles(e.target.value)}
                className="font-mono font-bold text-xs"
              />
            </div>

            <div className="p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">{t("Total Distance")}</span>
              <span className="text-lg font-black text-primary-600 dark:text-primary-400 font-mono">
                {activeTrip && parseFloat(endMiles) > (activeTrip.startMileage || 0)
                  ? (parseFloat(endMiles) - (activeTrip.startMileage || 0)).toFixed(1)
                  : totalMiles} <span className="text-xs font-normal text-slate-500">mi</span>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">{t("Trip Purpose / Destination Notes")}</label>
            <Input
              type="text"
              placeholder={t("e.g. Site Visit #562425 or Customer Location...")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs py-2.5 rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              <Plus size={16} />
              {isSaving
                ? t("Saving...")
                : activeTrip && endMiles
                ? t("End Trip & Save Mileage")
                : startMiles && !endMiles
                ? t("Start Trip (Save Starting Miles)")
                : t("Save Mileage Log")}
            </Button>
          </div>
        </form>

        {/* Mileage Log History List */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar size={14} />
            {t("Recent Mileage Logs")} ({userLogs.length})
          </h3>

          {userLogs.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 text-xs">
              {userLogs.slice(0, 15).map((log) => {
                const logDateStr = (() => {
                  const raw = log.date || log.timestamp || log.clockOut;
                  if (!raw) return 'Mileage Record';
                  const d = new Date(raw);
                  return isNaN(d.getTime()) ? 'Mileage Record' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                })();

                const calculatedMiles = (() => {
                  if (typeof log.miles === 'number' && log.miles > 0) return log.miles.toFixed(1);
                  if (typeof log.mileage === 'number' && log.mileage > 0) return log.mileage.toFixed(1);
                  if (typeof log.startMileage === 'number' && typeof log.endMileage === 'number' && log.endMileage >= log.startMileage) {
                    return (log.endMileage - log.startMileage).toFixed(1);
                  }
                  return '0.0';
                })();

                const isAutoTracked = log.isAutoTracked || (log.notes && (log.notes.includes('Auto-tracked') || log.notes.includes('shift-')));
                const isCompanyVehicleStatus = isAutoTracked ? (hasCompanyVehicle || log.isCompanyVehicle !== false) : (log.isCompanyVehicle ?? hasCompanyVehicle);
                
                const hasDetailedPurpose = log.businessPurpose || (log.notes && !log.notes.includes('Auto-tracked mileage on clock out') && !log.notes.startsWith('shift-'));
                const isAuditFlagged = isAutoTracked && !hasDetailedPurpose;
                const isEditingThisLog = editingLogId === log.id;

                return (
                  <div key={log.id} className={`p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl border ${isAuditFlagged ? 'bg-amber-500/5 dark:bg-amber-500/10 border-l-4 border-l-amber-500 border-amber-200 dark:border-amber-900' : 'border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {logDateStr}
                          </span>
                          {isAuditFlagged && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <AlertTriangle size={10} />
                              {t("Audit Flag: Purpose Needed")}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {log.startMileage && log.endMileage ? `${log.startMileage} ➔ ${log.endMileage} mi` : log.startMileage ? `${log.startMileage} mi (Trip Started)` : ''} {log.notes ? `• ${log.notes}` : ''}
                        </p>

                        {(log.startLocation || log.endLocation || log.location) && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                            {log.startLocation && (
                              <a
                                href={`https://maps.google.com/?q=${log.startLocation.lat},${log.startLocation.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-0.5 text-blue-600 hover:underline font-semibold"
                                title={t("Start Location")}
                              >
                                <MapPin size={10} />
                                {t("Start Loc")}
                              </a>
                            )}
                            {log.endLocation && (
                              <a
                                href={`https://maps.google.com/?q=${log.endLocation.lat},${log.endLocation.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-0.5 text-emerald-600 hover:underline font-semibold"
                                title={t("End Location")}
                              >
                                <MapPin size={10} />
                                {t("End Loc")}
                              </a>
                            )}
                            {!log.startLocation && !log.endLocation && log.location && (
                              <a
                                href={`https://maps.google.com/?q=${log.location.lat},${log.location.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-0.5 text-slate-500 hover:underline"
                                title={t("Location")}
                              >
                                <MapPin size={10} />
                                {t("Location")}
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-sm font-black text-primary-600 dark:text-primary-400 font-mono block">
                          +{calculatedMiles} mi
                        </span>
                        
                        {/* Interactive Personal / Company Vehicle Toggle Badge */}
                        <button
                          type="button"
                          onClick={() => handleToggleVehicleType(log)}
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

                    {/* Inline Full Mileage & Purpose Editor */}
                    {isEditingThisLog ? (
                      <div className="pt-2 p-3 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>{t("Edit Mileage Log")}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 uppercase">{t("Company Vehicle?")}</span>
                            <Toggle label="" enabled={editIsCompanyVehicle} onChange={setEditIsCompanyVehicle} />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Miles Driven")}</label>
                            <Input
                              type="number"
                              placeholder="e.g. 18.5"
                              value={editMilesText}
                              onChange={(e) => setEditMilesText(e.target.value)}
                              className="text-xs font-mono font-bold bg-white dark:bg-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Start Odometer")}</label>
                            <Input
                              type="number"
                              placeholder="Start"
                              value={editStartMilesText}
                              onChange={(e) => setEditStartMilesText(e.target.value)}
                              className="text-xs font-mono bg-white dark:bg-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("End Odometer")}</label>
                            <Input
                              type="number"
                              placeholder="End"
                              value={editEndMilesText}
                              onChange={(e) => setEditEndMilesText(e.target.value)}
                              className="text-xs font-mono bg-white dark:bg-slate-900"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-0.5">{t("Trip Purpose / Notes")}</label>
                          <Input
                            type="text"
                            placeholder={t("e.g. Service Visit for Customer #562425")}
                            value={editNotesText}
                            onChange={(e) => setEditNotesText(e.target.value)}
                            className="text-xs bg-white dark:bg-slate-900"
                          />
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
                            onClick={() => handleSaveFullEdit(log)}
                            disabled={isSavingPurpose}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-xl flex items-center gap-1"
                          >
                            <Check size={14} />
                            {isSavingPurpose ? t("Saving...") : t("Save Changes")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 gap-2">
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[240px]">
                          {log.businessPurpose || (isAuditFlagged ? t("⚠️ IRS audit requires a specific destination/business purpose.") : log.notes || '')}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(log)}
                            className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg transition-all flex items-center gap-1 ${
                              isAuditFlagged
                                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Edit3 size={11} />
                            {isAuditFlagged ? t("Add Purpose") : t("Edit")}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log.id)}
                            className="text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all flex items-center gap-1"
                            title={t("Delete Mileage Log Entry")}
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
              {t("No mileage logs recorded yet.")}
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
    </Modal>
  );
};

export default BriefingMileageModal;
