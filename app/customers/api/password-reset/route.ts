import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/accounts";
import { validateEmail } from "@/lib/validation";

export const runtime = "nodejs";

/** Public origin used to build reset links (proxy-friendly override). */
function requestOrigin(request: Request): string {
  return process.env.APP_ORIGIN ?? new URL(request.url).origin;
}

/**
 * POST /customers/api/password-reset
 *
 * Body: { email: string }
 * Always answers 202 with the same message so the endpoint cannot be used to
 * discover which emails have accounts. The mock mailer records the message in
 * data/outbox.json and prints it to the server log; in development the link is
 * also returned as `mockResetUrl` so the flow can be followed without a mail
 * server.
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
  const emailError = validateEmail(email);
  if (emailError) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: emailError,
        fieldErrors: { email: emailError },
      },
      { status: 400 },
    );
  }

  const result = await requestPasswordReset(email, requestOrigin(request));

  const message =
    "If an account exists for that email, a password reset link is on its way.";

  if (result.status === "sent") {
    console.info(
      `[mock-mail] Password reset for ${email.trim()}: ${result.resetUrl} (expires ${result.expiresAt})`,
    );
  }

  return NextResponse.json(
    {
      message,
      ...(result.status === "sent" && process.env.NODE_ENV !== "production"
        ? { mockResetUrl: result.resetUrl }
        : {}),
    },
    { status: 202 },
  );
}
