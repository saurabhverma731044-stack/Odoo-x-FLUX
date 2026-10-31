import { NextResponse } from "next/server";
import { findAccountById, type Account } from "@/lib/accounts";
import { can, isInternalRole, type Role } from "@/lib/rbac";
import { sessionAccountId } from "@/lib/session";

/**
 * Server-side authorisation helpers. Every guarded page and API route uses
 * these; nothing relies on the browser hiding controls.
 */

export type Viewer = Pick<Account, "id" | "email" | "role" | "createdAt">;

/** Resolves the signed-in account, with its role read fresh from the store. */
export async function getViewer(): Promise<Viewer | null> {
  const id = await sessionAccountId();
  if (!id) return null;

  const account = await findAccountById(id);
  if (!account) return null;

  return {
    id: account.id,
    email: account.email,
    role: account.role,
    createdAt: account.createdAt,
  };
}

export function canViewTeam(role: Role): boolean {
  return isInternalRole(role) && can(role, "customers:list");
}

export function unauthenticatedResponse(): NextResponse {
  return NextResponse.json(
    { error: "unauthenticated", message: "Sign in to continue." },
    { status: 401 },
  );
}

export function forbiddenResponse(action = "do that"): NextResponse {
  return NextResponse.json(
    {
      error: "forbidden",
      message: `Your role is not allowed to ${action}.`,
    },
    { status: 403 },
  );
}

/**
 * Rejects cross-site state changes. Browsers send Origin on POST/PATCH; a
 * missing Origin is allowed so server-to-server callers and tests work, and
 * the SameSite=Lax session cookie still blocks cross-site reuse.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function crossOriginResponse(): NextResponse {
  return NextResponse.json(
    { error: "cross_origin", message: "Cross-origin requests are not allowed." },
    { status: 403 },
  );
}

/** Where a signed-in viewer should land by default. */
export function homePathFor(role: Role): string {
  return canViewTeam(role) ? "/customers/team" : "/customers/account";
}

/** Only allow internal post-sign-in redirects. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/customers") || value.startsWith("//")) return null;
  return value;
}
