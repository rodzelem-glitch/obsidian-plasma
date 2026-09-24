export interface AuditLogEntry {
  id: string;
  jobId: string;
  organizationId: string;
  userId: string;
  userName: string;
  userRole?: string;
  action: 
    | 'Status Changed'
    | 'Stage Overridden'
    | 'Note Added/Edited'
    | 'Equipment Modified'
    | 'Proposal Linked'
    | 'Proposal Unlinked'
    | 'Proposal Deleted'
    | 'Photo Added'
    | 'Photo Deleted'
    | 'Parts Changed'
    | 'Refrigerant Changed'
    | 'Customer Signed'
    | 'Sign-Off Exception Logged'
    | 'Job Completed'
    | 'Job Reopened'
    | 'Offline Sync Activity'
    | 'Conflict Resolution';
  timestamp: string;
  previousValue?: string | number | boolean | Record<string, any> | null;
  newValue?: string | number | boolean | Record<string, any> | null;
  metadata?: Record<string, any>;
}
