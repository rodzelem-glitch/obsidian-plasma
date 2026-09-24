import { User } from '../types/user';

export type RestrictedAction =
  | 'override_workflow_stage'
  | 'edit_completed_job'
  | 'reopen_completed_job'
  | 'delete_proposal'
  | 'unlink_accepted_proposal'
  | 'modify_invoice'
  | 'edit_required_field_rules'
  | 'view_internal_recommendations'
  | 'assign_followup_tasks'
  | 'resolve_sync_conflicts';

export const ROLE_HIERARCHY: Record<string, number> = {
  Technician: 1,
  'Lead Technician': 2,
  Dispatcher: 2,
  'Office Staff': 3,
  Manager: 4,
  Administrator: 5,
  admin: 5,
  master_admin: 6,
  franchise_admin: 5,
  supervisor: 4,
};

/**
 * Matrix defining which roles can perform restricted actions by default
 */
const DEFAULT_ACTION_MATRIX: Record<RestrictedAction, string[]> = {
  override_workflow_stage: ['Lead Technician', 'Dispatcher', 'Office Staff', 'Manager', 'Administrator', 'admin', 'master_admin'],
  edit_completed_job: ['Manager', 'Administrator', 'admin', 'master_admin'],
  reopen_completed_job: ['Manager', 'Administrator', 'admin', 'master_admin'],
  delete_proposal: ['Manager', 'Administrator', 'admin', 'master_admin'],
  unlink_accepted_proposal: ['Manager', 'Administrator', 'admin', 'master_admin'],
  modify_invoice: ['Office Staff', 'Manager', 'Administrator', 'admin', 'master_admin'],
  edit_required_field_rules: ['Manager', 'Administrator', 'admin', 'master_admin'],
  view_internal_recommendations: ['Lead Technician', 'Dispatcher', 'Office Staff', 'Manager', 'Administrator', 'admin', 'master_admin'],
  assign_followup_tasks: ['Dispatcher', 'Office Staff', 'Manager', 'Administrator', 'admin', 'master_admin'],
  resolve_sync_conflicts: ['Lead Technician', 'Manager', 'Administrator', 'admin', 'master_admin'],
};

/**
 * Checks if a user has permission to execute a specific restricted action
 */
export function hasActionPermission(user: User | null | undefined, action: RestrictedAction): boolean {
  if (!user) return false;

  // Master admin & org admin override all restrictions
  if (user.role === 'master_admin' || user.role === 'admin' || user.role === 'Administrator') {
    return true;
  }

  // Explicit permission array grant
  if (user.permissions && user.permissions.includes(action)) {
    return true;
  }

  // Role matrix check
  const allowedRoles = DEFAULT_ACTION_MATRIX[action] || [];
  return allowedRoles.includes(user.role);
}
