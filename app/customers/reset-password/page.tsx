import Link from "next/link";
import type { Metadata } from "next";
import ResetPasswordForm from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset your password — Brightloop Software",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

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
            <h1>Choose a new password</h1>
            <p>
              This link can be used once and expires an hour after it was
              requested.
            </p>
          </div>

          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p className="alert" data-tone="error">
              This reset link is missing its token. Request a new one from the{" "}
              <Link href="/customers">signup page</Link>.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
