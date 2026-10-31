import { NextResponse } from "next/server";
import { createAccount } from "@/lib/accounts";
import { homePathFor } from "@/lib/authz";
import { startSession } from "@/lib/session";
import { validateEmail, validatePassword } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /customers/api/signup
 *
 * Body: { email: string, password: string }
 *  - 201 { account, redirectTo }          created
 *  - 400 { error, fieldErrors }           invalid input
 *  - 409 { error: "email_taken" }         email already registered
 */
export async function POST(request: Request) {
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

  const result = await createAccount(email, password);

  if (result.status === "email_taken") {
    return NextResponse.json(
      {
        error: "email_taken",
        message:
          "An account with this email already exists. Reset your password instead.",
      },
      { status: 409 },
    );
  }

  // New customers land signed in, on the page their role allows.
  await startSession(result.account.id);

  return NextResponse.json(
    { account: result.account, redirectTo: homePathFor(result.account.role) },
    { status: 201 },
  );
}
