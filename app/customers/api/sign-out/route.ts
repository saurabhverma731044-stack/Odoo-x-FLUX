import { NextResponse } from "next/server";
import { crossOriginResponse, isSameOrigin } from "@/lib/authz";
import { endSession } from "@/lib/session";

export const runtime = "nodejs";

/** POST /customers/api/sign-out — clears the session cookie. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  await endSession();
  return NextResponse.json({ ok: true });
}
