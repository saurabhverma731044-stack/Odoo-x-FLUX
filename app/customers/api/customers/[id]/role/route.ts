import { NextResponse } from "next/server";
import { updateAccountRole } from "@/lib/accounts";
import {
  crossOriginResponse,
  forbiddenResponse,
  getViewer,
  isSameOrigin,
  unauthenticatedResponse,
} from "@/lib/authz";
import { can, isRole, ROLE_LABELS } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * PATCH /customers/api/customers/:id/role
 * Body: { role: "admin" | "staff" | "customer" }
 * Admin only. Staff can read the list but never change a role, and no one can
 * change their own role (which would otherwise allow silent self-promotion or
 * locking every admin out).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return crossOriginResponse();

  const viewer = await getViewer();
  if (!viewer) return unauthenticatedResponse();
  if (!can(viewer.role, "role:assign")) return forbiddenResponse("assign roles");

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const role = (payload as Record<string, unknown> | null)?.role;
  if (!isRole(role)) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Choose one of: admin, staff, customer.",
        fieldErrors: { role: "Unknown role." },
      },
      { status: 400 },
    );
  }

  if (id === viewer.id) {
    return NextResponse.json(
      {
        error: "self_role_change",
        message:
          "You cannot change your own role. Ask another admin to do it for you.",
      },
      { status: 400 },
    );
  }

  const result = await updateAccountRole(id, role);
  if (result.status === "not_found") {
    return NextResponse.json(
      { error: "not_found", message: "That account no longer exists." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    account: result.account,
    message: `${result.account.email} is now ${ROLE_LABELS[result.account.role]}. Their next request uses the new role.`,
  });
}
