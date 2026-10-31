import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  getViewer,
  unauthenticatedResponse,
} from "@/lib/authz";
import { can, ROLE_LABELS, ROLE_SUMMARIES, permissionsFor } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * GET /customers/api/me
 * Every signed-in role may read exactly one account: their own. There is no
 * id parameter on purpose — a customer portal user has no way to ask for
 * anyone else's data.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return unauthenticatedResponse();
  if (!can(viewer.role, "account:read:self")) return forbiddenResponse();

  return NextResponse.json({
    account: viewer,
    roleLabel: ROLE_LABELS[viewer.role],
    roleSummary: ROLE_SUMMARIES[viewer.role],
    permissions: permissionsFor(viewer.role),
  });
}
