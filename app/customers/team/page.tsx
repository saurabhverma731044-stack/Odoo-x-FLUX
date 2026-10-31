import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listAccounts } from "@/lib/accounts";
import { canViewTeam, getViewer } from "@/lib/authz";
import { can } from "@/lib/rbac";
import AccountHeader from "../_components/account-header";
import CustomerTable from "./customer-table";

export const metadata: Metadata = {
  title: "Team & customers — Brightloop Software",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function TeamPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/customers/sign-in?next=/customers/team");

  // Page-level guard: the customer portal never reaches the list UI.
  if (!canViewTeam(viewer.role)) redirect("/customers/account");

  const accounts = await listAccounts();
  const rows = accounts.map((account) => ({
    id: account.id,
    email: account.email,
    role: account.role,
    joined: dateFormat.format(new Date(account.createdAt)),
  }));

  const counts = {
    total: rows.length,
    admin: rows.filter((row) => row.role === "admin").length,
    staff: rows.filter((row) => row.role === "staff").length,
    customer: rows.filter((row) => row.role === "customer").length,
  };

  return (
    <main className="app-page">
      <div className="app-shell">
        <AccountHeader viewer={viewer} />

        <div className="app-title">
          <div>
            <p className="eyebrow" style={{ color: "var(--accent)" }}>
              {viewer.role === "admin" ? "Admin" : "Internal staff"}
            </p>
            <h1>Team &amp; customers</h1>
            <p className="lede">
              Every Brightloop account and the role that decides what it can
              reach.
              {can(viewer.role, "role:assign")
                ? " You can change roles and add staff."
                : " Role changes and new staff are handled by an admin."}
            </p>
          </div>
        </div>

        <ul className="stats">
          <li>
            <span className="stat-value">{counts.total}</span>
            <span className="stat-label">Accounts</span>
          </li>
          <li>
            <span className="stat-value">{counts.admin}</span>
            <span className="stat-label">Admins</span>
          </li>
          <li>
            <span className="stat-value">{counts.staff}</span>
            <span className="stat-label">Internal staff</span>
          </li>
          <li>
            <span className="stat-value">{counts.customer}</span>
            <span className="stat-label">Customer portal</span>
          </li>
        </ul>

        <CustomerTable
          rows={rows}
          viewerId={viewer.id}
          canAssignRoles={can(viewer.role, "role:assign")}
          canAddStaff={can(viewer.role, "staff:add")}
        />
      </div>
    </main>
  );
}
