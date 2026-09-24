import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Textarea from '../ui/Textarea';
import { Job } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useLanguage } from 'context/LanguageContext';
import { hasActionPermission } from '../../lib/permissions';
import { logJobAuditActivity } from '../../lib/auditLogger';
import { db } from '../../lib/firebase';
import showToast from 'lib/toast';
import { AlertTriangle, Lock, Unlock } from 'lucide-react';

interface ReopenJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  onJobReopened: (updatedJob: Job) => void;
}

const ReopenJobModal: React.FC<ReopenJobModalProps> = ({ isOpen, onClose, job, onJobReopened }) => {
  const { state } = useAppContext();
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = state.currentUser;
  const canReopen = hasActionPermission(currentUser, 'reopen_completed_job');

  const handleReopen = async () => {
    if (!canReopen) {
      showToast.error(t("You do not have permission to reopen completed jobs. Manager authorization required."));
      return;
    }
    if (!reason.trim()) {
      showToast.warn(t("Please enter a clear reason for reopening this job."));
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const snapshot = JSON.parse(JSON.stringify(job));

      const reopenRecord = {
        reopenedAt: timestamp,
        reopenedById: currentUser?.id || 'admin',
        reopenedByName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'System Admin',
        reason: reason.trim(),
        snapshot,
      };

      const updatedReopenHistory = [...(job.reopenHistory || []), reopenRecord];

      // Update Firestore job document if not in demo mode
      if (!state.isDemoMode) {
        await db.collection('jobs').doc(job.id).update({
          jobStatus: 'In Progress',
          reopenHistory: updatedReopenHistory,
          updatedAt: timestamp,
          updatedById: currentUser?.id || 'admin',
        });

        // Audit Log Entry
        await logJobAuditActivity({
          jobId: job.id,
          organizationId: job.organizationId,
          userId: currentUser?.id || 'admin',
          userName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Admin',
          userRole: currentUser?.role || 'Admin',
          action: 'Job Reopened',
          previousValue: 'Completed',
          newValue: 'In Progress',
          metadata: {
            reason: reason.trim(),
            reopenedAt: timestamp,
          },
        });

        // Send Office Notification Queue
        await db.collection('mail_queue').add({
          to: [state.currentOrganization?.email || 'office@tektrakker.com'],
          message: {
            subject: `NOTICE: Completed Job Reopened - WO #${job.poNumber || job.id.slice(-6)}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>Completed Job Reopened</h2>
                <p>Job <strong>#${job.id}</strong> (Customer: ${job.customerName}) has been reopened from Completed status to In Progress.</p>
                <p><strong>Reopened By:</strong> ${currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Admin'}</p>
                <p><strong>Reason:</strong> ${reason.trim()}</p>
                <p><strong>Timestamp:</strong> ${new Date(timestamp).toLocaleString()}</p>
              </div>
            `,
          },
          type: 'ReopenNotification',
          createdAt: timestamp,
        });
      }

      const updatedJob: Job = {
        ...job,
        jobStatus: 'In Progress',
        reopenHistory: updatedReopenHistory,
      };

      showToast.success(t("Job successfully reopened for edit. Office notified."));
      onJobReopened(updatedJob);
      onClose();
    } catch (err) {
      console.error("Failed to reopen job:", err);
      showToast.error(t("Failed to reopen job. Please check permissions."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("Reopen Completed Job")} size="md">
      <div className="space-y-4 text-slate-800 dark:text-slate-200">
        {!canReopen ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3">
            <Lock className="shrink-0 text-rose-600" size={20} />
            <div>
              <strong className="block font-bold">{t("Authorization Restricted")}</strong>
              <span>{t("Only Managers and Administrators have permission to reopen completed jobs.")}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-900 dark:text-amber-300 text-xs flex items-start gap-3">
              <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={18} />
              <div>
                <strong className="block font-bold">{t("Manager Override Required")}</strong>
                <span>{t("Reopening a completed job will change its status back to 'In Progress', log a permanent audit entry, and notify office staff.")}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                {t("Reason for Reopening (Required)")}
              </label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("Explain why this completed job requires reopening (e.g. Return visit required, missed reading, additional work requested)...")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                {t("Cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleReopen}
                disabled={isSubmitting}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-2"
              >
                <Unlock size={16} />
                {isSubmitting ? t("Reopening...") : t("Authorize & Reopen Job")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReopenJobModal;
