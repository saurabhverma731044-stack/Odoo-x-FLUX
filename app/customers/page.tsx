import Link from "next/link";
import type { Metadata } from "next";
import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Create your account — Brightloop Software",
  description:
    "Create a Brightloop Software customer account. One account per email address.",
};

export default function CustomersPage() {
  return (
    <main className="signup-page">
      <div className="signup-shell">
        <section className="brand-panel">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              B
            </span>
            Brightloop Software
          </Link>

          <div className="brand-copy">
            <p className="eyebrow">Customer accounts</p>
            <h1>Create your Brightloop account</h1>
            <p className="lede">
              One account per email address. It follows you across every
              Brightloop product, from billing to support.
            </p>
          </div>

          <ul className="benefit-list">
            <li>One email, one account — no duplicates to untangle</li>
            <li>Manage your workspace, invoices and seats in one place</li>
            <li>Reset your password any time with a single link</li>
          </ul>

          <p className="brand-footnote">
            Already a customer? Enter your email under “Forgot your password?”
            and we will send you a fresh reset link.
          </p>
        </section>

        <section className="form-panel">
          <SignupForm />
          <p className="hint">
            Already have an account?{" "}
            <Link href="/customers/sign-in">Sign in</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
