import Link from "next/link";
import type { Viewer } from "@/lib/authz";
import { canViewTeam } from "@/lib/authz";
import { ROLE_LABELS, can } from "@/lib/rbac";
import SignOutButton from "./sign-out-button";

export default function AccountHeader({ viewer }: { viewer: Viewer }) {
  return (
    <header className="app-header">
      <div className="app-brand">
        <Link className="brand brand-dark" href="/customers">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          Brightloop Software
        </Link>
        <span className="badge" data-role={viewer.role}>
          {ROLE_LABELS[viewer.role]}
        </span>
      </div>

      <div className="app-header-right">
        <nav className="app-nav" aria-label="Account">
          {canViewTeam(viewer.role) ? (
            <Link href="/customers/team">Team &amp; customers</Link>
          ) : null}
          <Link href="/customers/account">My account</Link>
        </nav>
        <span className="app-viewer">{viewer.email}</span>
        <SignOutButton />
      </div>

      {!can(viewer.role, "customers:list") ? (
        <p className="app-scope">
          Signed in to the customer portal. You can only see your own account
          data.
        </p>
      ) : null}
    </header>
  );
}
