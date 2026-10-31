import { NextResponse } from "next/server";
import { createTeamMember } from "@/lib/accounts";
import {
  crossOriginResponse,
  forbiddenResponse,
  getViewer,
  isSameOrigin,
  unauthenticatedResponse,
} from "@/lib/authz";
import { can } from "@/lib/rbac";
import { validateEmail, validatePassword } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /customers/api/staff
 * Body: { email, password }
 *
 * Admin only — this is the only way to create an internal staff account. The
 * role is fixed to "staff" by the server: a caller cannot pass a role, so this
 * endpoint can never mint another admin. Staff created here sign in with the
 * temporary password the admin sets.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();

  const viewer = await getViewer();
  if (!viewer) return unauthenticatedResponse();
  if (!can(viewer.role, "staff:add")) return forbiddenResponse("add staff members");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (typeof body.role === "string" && body.role !== "staff") {
    return NextResponse.json(
      {
        error: "forbidden_role",
        message:
          "This endpoint only adds internal staff. Change roles from the customer table instead.",
      },
      { status: 400 },
    );
  }

  const emailError = validateEmail(email);
  const passwordCheck = validatePassword(password);
  if (emailError || !passwordCheck.valid) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Please fix the highlighted fields.",
        fieldErrors: {
          ...(emailError ? { email: emailError } : {}),
          ...(passwordCheck.valid ? {} : { password: passwordCheck.failed }),
        },
      },
      { status: 400 },
    );
  }

  const result = await createTeamMember(email, password, "staff");
  if (result.status === "email_taken") {
    return NextResponse.json(
      {
        error: "email_taken",
        message: "An account with this email already exists.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      account: result.account,
      message: `${result.account.email} was added as internal staff.`,
    },
    { status: 201 },
  );
}
