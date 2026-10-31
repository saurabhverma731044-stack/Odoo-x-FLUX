import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/accounts";
import {
  forbiddenResponse,
  getViewer,
  unauthenticatedResponse,
} from "@/lib/authz";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * GET /customers/api/customers
 * Admin and internal staff only. Customer-portal accounts get 403 — the list is
 * never filtered down for them, it is refused outright.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return unauthenticatedResponse();
  if (!can(viewer.role, "customers:list")) return forbiddenResponse("view customers");

  return NextResponse.json({
    customers: await listAccounts(),
    viewer: { id: viewer.id, role: viewer.role },
  });
}
