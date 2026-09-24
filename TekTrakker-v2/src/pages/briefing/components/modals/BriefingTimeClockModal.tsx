import React, { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { useLanguage } from '../../../../context/LanguageContext';
import { useAppContext } from '../../../../context/AppContext';
import { 
  Clock, 
  Play, 
  Square, 
  Pause, 
  CheckCircle2, 
  Calendar, 
  FileText,
  UserCheck,
  MapPin,
  Briefcase
} from 'lucide-react';
import showToast from '../../../../lib/toast';
import { db } from '../../../../lib/firebase';
import { cleanUndefinedFields } from '../../../../lib/utils';
import { getCurrentLocation } from '../../../../lib/geolocation';

interface BriefingTimeClockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BriefingTimeClockModal: React.FC<BriefingTimeClockModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  const { state, dispatch } = useAppContext();
  const { currentUser: user, shiftLogs } = state;

  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [isClockingIn, setIsClockingIn] = useState(false);

  // User shift history (handles map object or array format)
  const userShifts = React.useMemo(() => {
    if (!user?.id || !shiftLogs) return [];
    let list: any[] = [];
    if (Array.isArray(shiftLogs)) {
      list = shiftLogs.filter((s: any) => s && s.userId === user.id);
    } else if (typeof shiftLogs === 'object') {
      if (Array.isArray((shiftLogs as any)[user.id])) {
        list = (shiftLogs as any)[user.id];
      } else {
        list = Object.values(shiftLogs).flat().filter((s: any) => s && s.userId === user.id);
      }
    }
    return list.sort((a, b) => new Date(b.clockIn || b.date || 0).getTime() - new Date(a.clockIn || a.date || 0).getTime());
  }, [shiftLogs, user?.id]);

  // Active shift logic
  const activeShift = React.useMemo(() => {
    return userShifts.find((s: any) => !s.clockOut);
  }, [userShifts]);

  const allJobs = React.useMemo(() => {
    return [...(state.jobs || []), ...(state.externalJobs || [])];
  }, [state.jobs, state.externalJobs]);

  const getJobsForShift = React.useCallback((shift: any) => {
    if (!user?.id || !shift.clockIn) return [];
    const shiftStart = new Date(shift.clockIn).getTime();
    const shiftEnd = shift.clockOut ? new Date(shift.clockOut).getTime() : Date.now();
    const shiftDateStr = shift.date || (shift.clockIn ? shift.clockIn.split('T')[0] : null);

    return allJobs.filter((job) => {
      const isAssigned =
        job.assignedTechnicianId === user.id ||
        (job.assignedCrew && job.assignedCrew.includes(user.id)) ||
        (job.assistants && job.assistants.includes(user.id)) ||
        (user.role === 'Subcontractor' && job.subcontractorId === user.id);

      if (!isAssigned) return false;

      const apptTime = job.appointmentTime ? new Date(job.appointmentTime).getTime() : 0;
      const checkInTime = job.checkInTime ? new Date(job.checkInTime).getTime() : 0;
      const checkOutTime = job.checkOutTime ? new Date(job.checkOutTime).getTime() : 0;

      const timeMatches =
        (apptTime >= shiftStart && apptTime <= shiftEnd) ||
        (checkInTime >= shiftStart && checkInTime <= shiftEnd) ||
        (checkOutTime >= shiftStart && checkOutTime <= shiftEnd);

      const dateMatches = shiftDateStr && job.appointmentTime && job.appointmentTime.startsWith(shiftDateStr);

      return timeMatches || dateMatches;
    });
  }, [allJobs, user?.id, user?.role]);

  // Calculate elapsed time ticker
  useEffect(() => {
    let timer: any;
    if (activeShift && activeShift.clockIn) {
      const updateTimer = () => {
        const now = new Date().getTime();
        const start = new Date(activeShift.clockIn).getTime();
        const diffMs = now - start;

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      };
      updateTimer();
      timer = setInterval(updateTimer, 1000);
    } else {
      setElapsedTime('00:00:00');
    }
    return () => clearInterval(timer);
  }, [activeShift]);

  // Handle Clock In / Clock Out
  const handleToggleClock = async () => {
    if (!user) return;
    setIsClockingIn(true);
    try {
      const now = new Date();
      let locationData = null;

      try {
        const coords = await getCurrentLocation();
        locationData = {
          lat: coords.latitude,
          lng: coords.longitude,
        };
      } catch (e) {
        console.warn("Location capture skipped:", e);
      }

      if (activeShift) {
        // Clock Out
        const startMs = new Date(activeShift.clockIn).getTime();
        const endMs = now.getTime();
        const hoursWorked = parseFloat(((endMs - startMs) / (1000 * 60 * 60)).toFixed(2));

        const activeOrgId = activeShift.organizationId || user.organizationId || state.currentOrganization?.id || 'unaffiliated';
        const updatedShift = {
          ...activeShift,
          organizationId: activeOrgId,
          clockOut: now.toISOString(),
          hoursWorked,
          clockOutLocation: locationData,
        };

        if (activeShift.id) {
          await db.collection('shiftLogs').doc(activeShift.id).update(cleanUndefinedFields(updatedShift));
        }
        dispatch({ type: 'UPDATE_SHIFT_LOG', payload: { userId: user.id, log: updatedShift } });

        // Auto-generate Mileage Log on clock out with discernible work order destination
        try {
          const shiftJobs = getJobsForShift(updatedShift);
          let autoNotes = `Auto-tracked mileage on clock out for shift ${activeShift.id || ''}`;
          let businessPurpose = '';

          if (shiftJobs.length > 0) {
            const firstJob = shiftJobs[0];
            const siteAddr = firstJob.customerName || firstJob.locationName || firstJob.address || 'Service Site';
            const woId = firstJob.poNumber || firstJob.id.slice(-6).toUpperCase();
            autoNotes = `Drive to Service Site: ${siteAddr} (WO #${woId})`;
            businessPurpose = autoNotes;
          }

          let autoMiles = 0;
          if (activeShift.startMileage && activeShift.endMileage) {
            autoMiles = Math.max(0, parseFloat(activeShift.endMileage) - parseFloat(activeShift.startMileage));
          }
          if (autoMiles === 0 && shiftJobs.length > 0) {
            autoMiles = shiftJobs.reduce((sum: number, j: any) => sum + (j.travelMiles || j.miles || 18.5), 0);
          }
          if (autoMiles === 0) {
            const hoursNum = typeof hoursWorked === 'number' ? hoursWorked : parseFloat(String(hoursWorked || '0'));
            autoMiles = Math.round(hoursNum * 12.5 * 10) / 10;
          }

          const autoLogId = `vlog_auto_${Date.now()}`;
          const autoLog = {
            id: autoLogId,
            userId: user.id,
            techId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            organizationId: activeOrgId,
            date: now.toISOString().split('T')[0],
            timestamp: now.toISOString(),
            type: 'Mileage' as const,
            miles: autoMiles,
            isCompanyVehicle: true,
            isAutoTracked: true,
            notes: autoNotes,
            businessPurpose: businessPurpose || undefined,
            auditFlagged: !businessPurpose,
            clockIn: activeShift.clockIn,
            clockOut: now.toISOString(),
          };

          await db.collection('vehicleLogs').doc(autoLogId).set(cleanUndefinedFields(autoLog));
          dispatch({ type: 'ADD_VEHICLE_LOG', payload: autoLog });
        } catch (vErr) {
          console.warn("Auto-tracked mileage generation skipped:", vErr);
        }

        showToast.success(t("Clocked Out successfully!"));
        onClose();
      } else {
        // Clock In
        const activeOrgId = user.organizationId || state.currentOrganization?.id || 'unaffiliated';
        const newShiftId = `shift_${Date.now()}`;
        const newShift = {
          id: newShiftId,
          organizationId: activeOrgId,
          userId: user.id,
          date: now.toISOString().split('T')[0],
          clockIn: now.toISOString(),
          clockInLocation: locationData,
          hoursWorked: 0,
          status: 'Pending' as const,
        };

        await db.collection('shiftLogs').doc(newShiftId).set(cleanUndefinedFields(newShift));
        dispatch({ type: 'ADD_SHIFT_LOG', payload: { userId: user.id, log: newShift } });

        // Immediately sync starting coordinates to technician profile
        if (locationData) {
          const locPayload = { lat: locationData.lat, lng: locationData.lng, timestamp: now.toISOString() };
          await db.collection('users').doc(user.id).update(cleanUndefinedFields({
            location: locPayload,
            lastLocationUpdate: locPayload.timestamp
          })).catch(err => console.error("Immediate clock-in sync failed:", err));

          dispatch({ type: 'UPDATE_EMPLOYEE', payload: { ...user, location: locPayload } });
        }

        showToast.success(t("Clocked In successfully!"));
        onClose();
      }
    } catch (err: any) {
      console.error("Shift action failed:", err);
      showToast.error(t("Failed to update shift status: ") + err.message);
    } finally {
      setIsClockingIn(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Clock className="text-primary-600 shrink-0" size={24} />
          <div>
            <h2 className="font-extrabold text-base md:text-lg">{t("Time Clock & Shift Logs")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              {t("Live shift time tracking, breaks, and shift history logs.")}
            </p>
          </div>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6 pb-4">
        
        {/* Active Clock Banner */}
        <div className={`p-6 rounded-2xl border-2 transition-all text-center space-y-4 ${
          activeShift
            ? 'bg-emerald-50/70 border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-800'
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              {activeShift ? t("Currently Clocked In") : t("Off The Clock")}
            </span>
            <div className="text-4xl md:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {elapsedTime}
            </div>
            {activeShift && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mt-1">
                {t("Started at:")} {new Date(activeShift.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>

          <Button
            type="button"
            onClick={handleToggleClock}
            disabled={isClockingIn}
            className={`w-full sm:w-auto px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 mx-auto ${
              activeShift
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {activeShift ? <Square size={18} /> : <Play size={18} />}
            {isClockingIn ? t("Updating...") : activeShift ? t("Clock Out Now") : t("Clock In Now")}
          </Button>
        </div>

        {/* Shift History Log Table */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar size={14} />
            {t("Recent Shift Logs")} ({userShifts.length})
          </h3>

          {userShifts.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 text-xs">
              {userShifts.slice(0, 15).map((shift) => {
                const shiftDateStr = (() => {
                  const raw = shift.date || shift.clockIn;
                  if (!raw) return 'Shift Record';
                  const d = new Date(raw);
                  return isNaN(d.getTime()) ? 'Shift Record' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                })();

                const calculatedHours = (() => {
                  if (typeof shift.hoursWorked === 'number' && shift.hoursWorked > 0) {
                    return `${shift.hoursWorked.toFixed(1)} hrs`;
                  }
                  if (shift.clockIn && shift.clockOut) {
                    const inMs = new Date(shift.clockIn).getTime();
                    const outMs = new Date(shift.clockOut).getTime();
                    if (!isNaN(inMs) && !isNaN(outMs) && outMs > inMs) {
                      const hrs = (outMs - inMs) / (1000 * 60 * 60);
                      return `${hrs.toFixed(1)} hrs`;
                    }
                  }
                  if (shift.clockIn && !shift.clockOut) {
                    return t("In Progress");
                  }
                  return '0.0 hrs';
                })();

                const startLoc = shift.clockInLocation || shift.startLocation;
                const endLoc = shift.clockOutLocation || shift.endLocation;
                const assignedShiftJobs = getJobsForShift(shift);

                return (
                  <div key={shift.id} className="p-4 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block text-xs">
                          {shiftDateStr}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {shift.clockIn ? new Date(shift.clockIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'N/A'}
                          {' ➔ '}
                          {shift.clockOut ? new Date(shift.clockOut).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : t("Active")}
                        </span>

                        {/* Location Data Badge */}
                        {(startLoc || endLoc) && (
                          <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-fit">
                            <MapPin size={11} className="text-rose-500 shrink-0" />
                            <span>
                              {startLoc?.lat ? `In: ${startLoc.lat.toFixed(4)}, ${startLoc.lng.toFixed(4)}` : t("Location logged")}
                              {endLoc?.lat ? ` ➔ Out: ${endLoc.lat.toFixed(4)}, ${endLoc.lng.toFixed(4)}` : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono block">
                          {calculatedHours}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          shift.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {shift.status || 'Logged'}
                        </span>
                      </div>
                    </div>

                    {/* Assigned Jobs During Shift */}
                    {assignedShiftJobs.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                          💼 {t("Assigned Work Orders During Shift")} ({assignedShiftJobs.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {assignedShiftJobs.map((j) => (
                            <span
                              key={j.id}
                              className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/40 px-2 py-0.5 rounded-lg flex items-center gap-1"
                            >
                              <Briefcase size={10} className="shrink-0" />
                              WO #{j.poNumber || j.id.slice(-6).toUpperCase()} • {j.customerName || j.locationName || 'Site Location'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-slate-400 text-xs italic">
              {t("No shift logs recorded yet.")}
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

export default BriefingTimeClockModal;
