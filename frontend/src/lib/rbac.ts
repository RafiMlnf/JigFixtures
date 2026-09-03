/**
 * RBAC utility — single source of truth for all role-based access rules.
 *
 * Reference table (from design document):
 * ┌─────────────────┬──────────────────┬────────┬──────────┬──────────┐
 * │ Role            │ View             │ Update │ Approval │ Download │
 * ├─────────────────┼──────────────────┼────────┼──────────┼──────────┤
 * │ PE_JIG_FIXTURE  │ ✓                │ ✓      │ Submit   │ ✓        │
 * │ PE_SECTION_HEAD │ ✓                │ ✗      │ ✓        │ ✓        │
 * │ PE_DEPT_HEAD    │ ✓                │ ✗      │ ✓        │ ✓        │
 * │ TAMU            │ ✓ (Approved only)│ ✗      │ ✗        │ ✓        │
 * └─────────────────┴──────────────────┴────────┴──────────┴──────────┘
 */

export type AppRole = 'PE_JIG_FIXTURE' | 'PE_SECTION_HEAD' | 'PE_DEPT_HEAD' | 'TAMU';

// ─── Role sets ────────────────────────────────────────────────────────────────

/** Roles that can approve / reject approval requests */
export const APPROVER_ROLES: AppRole[] = ['PE_SECTION_HEAD', 'PE_DEPT_HEAD'];

/** Roles that can edit stock (Update column) */
export const EDITOR_ROLES: AppRole[] = ['PE_JIG_FIXTURE'];

/** Roles that can access the Approval Center page (PIC submits, approvers decide) */
export const APPROVAL_CENTER_ROLES: AppRole[] = ['PE_JIG_FIXTURE', 'PE_SECTION_HEAD', 'PE_DEPT_HEAD'];

/** Roles that can download / export */
export const DOWNLOADER_ROLES: AppRole[] = ['PE_JIG_FIXTURE', 'PE_SECTION_HEAD', 'PE_DEPT_HEAD', 'TAMU'];

// ─── Helper functions ─────────────────────────────────────────────────────────

/** Can decide (approve / reject) an approval request */
export function canApprove(role?: AppRole | null): boolean {
  return !!role && APPROVER_ROLES.includes(role);
}

/** Can submit / edit stock and design data */
export function canEdit(role?: AppRole | null): boolean {
  return !!role && EDITOR_ROLES.includes(role);
}

/** Can access the Approval Center (view + submit or decide) */
export function canViewApprovalCenter(role?: AppRole | null): boolean {
  return !!role && APPROVAL_CENTER_ROLES.includes(role);
}

/** Can download / export data */
export function canDownload(role?: AppRole | null): boolean {
  return !!role && DOWNLOADER_ROLES.includes(role);
}

/** Guest / Tamu — view-only, approved items only */
export function isGuest(role?: AppRole | null): boolean {
  return role === 'TAMU' || !role;
}

/** View-only roles: cannot edit, cannot approve */
export function isViewOnly(role?: AppRole | null): boolean {
  return !canEdit(role) && !canApprove(role);
}
