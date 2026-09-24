import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Job } from '../../types';
import { AuditLogEntry } from '../../types/audit';
import { db } from '../../lib/firebase';
import { useLanguage } from 'context/LanguageContext';
import { History, Shield, Clock, User as UserIcon } from 'lucide-react';

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
}

const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({ isOpen, onClose, job }) => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !job?.id) return;
    let isMounted = true;

    async function fetchAuditLogs() {
      setIsLoading(true);
      let fetchedLogs: AuditLogEntry[] = [];
      try {
        // Query centralized job_audit_logs collection (if permitted)
        const snap = await db.collection('job_audit_logs').where('jobId', '==', job.id).get();
        fetchedLogs = snap.docs.map(doc => doc.data() as AuditLogEntry);
      } catch (err: any) {
        console.warn("Could not query central audit collection (falling back to inline job events):", err?.message || err);
      }

      try {
        // Fallback / merge with inline jobEvents
        const inlineEvents = (job.jobEvents || []).map((e: any) => ({
          id: e.id || `evt_${Math.random()}`,
          jobId: job.id,
          organizationId: job.organizationId,
          userId: e.userId || 'system',
          userName: e.userName || e.user || 'System User',
          userRole: e.userRole || 'Technician',
          action: (e.action || e.type || 'Activity Logged') as any,
          timestamp: e.timestamp || e.createdAt || new Date().toISOString(),
          previousValue: e.previousValue || null,
          newValue: e.newValue || null,
          metadata: e.metadata || e,
        }));

        const mergedMap = new Map<string, AuditLogEntry>();
        [...inlineEvents, ...fetchedLogs].forEach(item => {
          mergedMap.set(item.id, item);
        });

        const sorted = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        if (isMounted) {
          setLogs(sorted);
        }
      } catch (err) {
        console.error("Failed to build audit logs list:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchAuditLogs();
    return () => { isMounted = false; };
  }, [isOpen, job?.id, job?.jobEvents, job?.organizationId]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("Permanent Job Audit History")} size="lg">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar p-1 text-slate-800 dark:text-slate-200">
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <Shield size={16} className="text-emerald-600" />
            <span>{t("Immutable Job Audit Log — Record #")}{job.id.slice(-6).toUpperCase()}</span>
          </div>
          <span className="text-[11px] font-bold text-slate-400">{logs.length} {t("Entries Logged")}</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-xs text-slate-400">{t("Loading audit trail...")}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 border-2 border-dashed rounded-xl">
            {t("No formal audit log entries recorded yet.")}
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="p-3.5 bg-white dark:bg-slate-900 border rounded-xl shadow-sm text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded border border-primary-200 dark:border-primary-800">
                      {typeof log.action === 'string' ? log.action : (typeof log.action === 'object' ? ((log.action as any).name || (log.action as any).type || String(log.action)) : String(log.action || 'Activity Logged'))}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                    <Clock size={12} />
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                    <UserIcon size={12} className="text-slate-400" />
                    <strong>{typeof log.userName === 'string' ? log.userName : String(log.userName || 'System User')}</strong>
                    {log.userRole && <span className="text-slate-400">({log.userRole})</span>}
                  </div>
                </div>

                {(log.previousValue !== undefined || log.newValue !== undefined) && (
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-100 dark:border-slate-800 font-mono text-[10px]">
                    <div>
                      <span className="text-slate-400 block font-sans font-bold">{t("Previous Value:")}</span>
                      <span className="text-rose-600 truncate block">
                        {typeof log.previousValue === 'object' ? JSON.stringify(log.previousValue) : String(log.previousValue ?? 'N/A')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans font-bold">{t("New Value:")}</span>
                      <span className="text-emerald-600 truncate block">
                        {typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : String(log.newValue ?? 'N/A')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("Close Audit Trail")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AuditHistoryModal;
