import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer, homePathFor, safeNextPath } from "@/lib/authz";
import { ROLE_SUMMARIES } from "@/lib/rbac";
import SignInForm from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in — Brightloop Software",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const viewer = await getViewer();
  if (viewer) redirect(homePathFor(viewer.role));

  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <main className="signup-page">
      <div className="signup-shell single">
        <section className="form-panel">
          <Link className="brand brand-dark" href="/">
            <span className="brand-mark" aria-hidden="true">
              B
            </span>
            Brightloop Software
          </Link>

          <div className="form-heading">
            <h1>Sign in</h1>
            <p>
              Your role decides what you see: admins manage the team, staff read
              the customer list, customers only ever see their own account.
            </p>
          </div>

          <SignInForm next={next} />

          <p className="hint">
            No account yet? <Link href="/customers">Create one</Link>.
          </p>

          <div className="role-legend">
            {(["admin", "staff", "customer"] as const).map((role) => (
              <p key={role}>
                <span className="badge" data-role={role}>
                  {role === "staff" ? "Internal staff" : role === "admin" ? "Admin" : "Customer portal"}
                </span>
                {ROLE_SUMMARIES[role]}
              </p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
