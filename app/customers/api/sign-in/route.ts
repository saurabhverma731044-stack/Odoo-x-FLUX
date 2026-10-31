import { NextResponse } from "next/server";
import { findAccountByEmail } from "@/lib/accounts";
import { crossOriginResponse, homePathFor, isSameOrigin } from "@/lib/authz";
import { hashPassword, verifyPassword } from "@/lib/security";
import { startSession } from "@/lib/session";
import { validateEmail } from "@/lib/validation";

export const runtime = "nodejs";

let dummyHash: Promise<string> | null = null;

/** Keeps failed sign-ins roughly as slow as successful ones. */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("brightloop-timing-equalizer");
  return dummyHash;
}

/**
 * POST /customers/api/sign-in
 * Body: { email, password }
 * Answers 401 with one generic message for every failure, so the endpoint
 * cannot be used to discover which emails have accounts.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();

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
  if (emailError || password.length === 0) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Enter your email address and password.",
        fieldErrors: {
          ...(emailError ? { email: emailError } : {}),
          ...(password.length === 0 ? { password: "Enter your password." } : {}),
        },
      },
      { status: 400 },
    );
  }

  const account = await findAccountByEmail(email);
  let valid = false;
  if (account) {
    valid = await verifyPassword(password, account.passwordHash);
  } else {
    // Spend the same hashing time so a missing account is not detectable.
    await verifyPassword(password, await getDummyHash());
  }

  if (!account || !valid) {
    return NextResponse.json(
      {
        error: "invalid_credentials",
        message: "That email and password combination is not correct.",
      },
      { status: 401 },
    );
  }

  await startSession(account.id);

  return NextResponse.json({
    account: {
      id: account.id,
      email: account.email,
      role: account.role,
      createdAt: account.createdAt,
    },
    redirectTo: homePathFor(account.role),
  });
}
