import { db } from './firebase';
import { cleanUndefinedFields } from './utils';
import { AuditLogEntry } from '../types/audit';

export async function logJobAuditActivity(params: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const timestamp = new Date().toISOString();
  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const auditEntry: AuditLogEntry = {
    ...params,
    id: logId,
    timestamp,
  };

  try {
    // 1. Write to centralized job_audit_logs collection
    await db.collection('job_audit_logs').doc(logId).set(cleanUndefinedFields(auditEntry));

    // 2. Append to job document's jobEvents array for fast inline auditing
    const jobRef = db.collection('jobs').doc(params.jobId);
    const docSnap = await jobRef.get();
    if (docSnap.exists) {
      const currentEvents = docSnap.data()?.jobEvents || [];
      await jobRef.update({
        jobEvents: [...currentEvents, cleanUndefinedFields(auditEntry)],
        updatedAt: timestamp,
        updatedById: params.userId,
        updatedByName: params.userName,
      });
    }
  } catch (err) {
    console.error(`[logJobAuditActivity] Failed to persist audit entry for action ${params.action}:`, err);
  }
}
