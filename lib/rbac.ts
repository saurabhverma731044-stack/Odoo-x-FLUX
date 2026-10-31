/**
 * Role-based access control for Brightloop Software.
 *
 * Three roles, deliberately narrow:
 *   - admin    full system access, including role management and adding staff
 *   - staff    day-to-day work access (read the customer list, nothing else)
 *   - customer restricted to their own account data
 *
 * The matrix below is the single source of truth. UI code uses `can()` only to
 * decide what to render; every API route re-checks it server-side, and page
 * guards re-check it on each request.
 */

export const ROLES = ["admin", "staff", "customer"] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "customers:list",
  "account:read:self",
  "staff:add",
  "role:assign",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  staff: "Internal staff",
  customer: "Customer portal",
};

export const ROLE_SUMMARIES: Record<Role, string> = {
  admin: "Full system access: the customer list, role changes, and adding staff.",
  staff: "Day-to-day access: can view the customer list, but cannot change roles or add people.",
  customer: "Restricted to their own account data. Cannot see other accounts at all.",
};

const GRANTS: Record<Role, readonly Permission[]> = {
  admin: ["customers:list", "account:read:self", "staff:add", "role:assign"],
  staff: ["customers:list", "account:read:self"],
  customer: ["account:read:self"],
};

export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): readonly Permission[] {
  return GRANTS[role] ?? [];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Roles that may use the staff/admin area at all. */
export function isInternalRole(role: Role): boolean {
  return role === "admin" || role === "staff";
}
