import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/accounts";
import { validatePassword } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * POST /customers/api/password-reset/confirm
 *
 * Body: { token: string, password: string }
 *  - 200 { message }             password replaced, token consumed
 *  - 400 { error, fieldErrors }  weak password
 *  - 400 { error: "invalid_token" } unknown, used or expired link
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
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (token.length === 0) {
    return NextResponse.json(
      { error: "invalid_token", message: "This reset link is not valid." },
      { status: 400 },
    );
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Please fix the highlighted fields.",
        fieldErrors: { password: passwordCheck.failed },
      },
      { status: 400 },
    );
  }

  const result = await resetPasswordWithToken(token, password);

  if (result.status === "invalid_token") {
    return NextResponse.json(
      {
        error: "invalid_token",
        message:
          "This reset link is invalid, already used, or expired. Request a new one.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    message: "Your password has been reset. You can sign in with it now.",
  });
}
