import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canViewTeam, getViewer } from "@/lib/authz";
import { ROLE_LABELS, ROLE_SUMMARIES, permissionsFor } from "@/lib/rbac";
import AccountHeader from "../_components/account-header";

export const metadata: Metadata = {
  title: "My account — Brightloop Software",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/customers/sign-in?next=/customers/account");

  // This page reads the viewer and nothing else: no account ids from the URL,
  // no list query. A customer portal user has no way to address another account.
  const permissions = permissionsFor(viewer.role);

  return (
    <main className="app-page">
      <div className="app-shell">
        <AccountHeader viewer={viewer} />

        <div className="app-title">
          <div>
            <p className="eyebrow" style={{ color: "var(--accent)" }}>
              {ROLE_LABELS[viewer.role]}
            </p>
            <h1>My account</h1>
            <p className="lede">{ROLE_SUMMARIES[viewer.role]}</p>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Account details</h2>
              <p className="hint">
                Only you and Brightloop staff with list access can see this
                record.
              </p>
            </div>
            <span className="badge" data-role={viewer.role}>
              {ROLE_LABELS[viewer.role]}
            </span>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Email</dt>
              <dd>{viewer.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{ROLE_LABELS[viewer.role]}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{dateFormat.format(new Date(viewer.createdAt))}</dd>
            </div>
            <div>
              <dt>Account ID</dt>
              <dd className="mono">{viewer.id}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>What this role can do</h2>
              <p className="hint">
                Enforced on the server for every request, not just hidden in the
                interface.
              </p>
            </div>
          </div>

          <ul className="permission-list">
            {permissions.map((permission) => (
              <li key={permission}>
                <code>{permission}</code>
              </li>
            ))}
          </ul>

          {canViewTeam(viewer.role) ? (
            <p className="hint">
              Looking for the customer list?{" "}
              <Link href="/customers/team">Open team &amp; customers</Link>.
            </p>
          ) : (
            <p className="hint">
              Need access to more of Brightloop? Ask an admin — role changes are
              restricted to them.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
