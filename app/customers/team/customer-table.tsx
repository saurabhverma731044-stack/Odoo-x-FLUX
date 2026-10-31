"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";
import AddStaffForm from "./add-staff-form";

export type CustomerRow = {
  id: string;
  email: string;
  role: Role;
  joined: string;
};

type Props = {
  rows: CustomerRow[];
  viewerId: string;
  canAssignRoles: boolean;
  canAddStaff: boolean;
};

export default function CustomerTable({
  rows,
  viewerId,
  canAssignRoles,
  canAddStaff,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingStaff, setAddingStaff] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = needle.length === 0 || row.email.toLowerCase().includes(needle);
      const matchesRole = roleFilter === "all" || row.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [rows, query, roleFilter]);

  async function changeRole(row: CustomerRow, role: Role) {
    setBusyId(row.id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/customers/api/customers/${row.id}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data?.message ?? "That role change was not allowed.");
        return;
      }

      setNotice(data?.message ?? "Role updated.");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="table-card">
      <div className="toolbar">
        <div className="field search-field">
          <label htmlFor="customer-search">Search</label>
          <input
            id="customer-search"
            type="search"
            placeholder="Search by email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="field filter-field">
          <label htmlFor="role-filter">Role</label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as Role | "all")}
          >
            <option value="all">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-actions">
          {canAddStaff ? (
            <button
              className="button"
              type="button"
              onClick={() => setAddingStaff((open) => !open)}
              aria-expanded={addingStaff}
            >
              {addingStaff ? "Cancel" : "Add staff member"}
            </button>
          ) : (
            <span className="toolbar-note">Only admins can add staff.</span>
          )}
        </div>
      </div>

      {addingStaff && canAddStaff ? (
        <AddStaffForm onClose={() => setAddingStaff(false)} />
      ) : null}

      {notice ? (
        <p className="alert" data-tone="success" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="alert" data-tone="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">
            Brightloop accounts with their role and signup date
          </caption>
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Joined</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isSelf = row.id === viewerId;
              return (
                <tr key={row.id}>
                  <td>
                    <span className="cell-email">{row.email}</span>
                    {isSelf ? <span className="you-tag">you</span> : null}
                  </td>
                  <td>
                    {canAssignRoles && !isSelf ? (
                      <select
                        className="role-select"
                        aria-label={`Role for ${row.email}`}
                        value={row.role}
                        disabled={busyId === row.id}
                        onChange={(event) => changeRole(row, event.target.value as Role)}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge" data-role={row.role}>
                        {ROLE_LABELS[row.role]}
                      </span>
                    )}
                  </td>
                  <td className="cell-muted">{row.joined}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visible.length === 0 ? (
          <p className="table-empty">No accounts match that search.</p>
        ) : null}
      </div>

      <p className="table-foot">
        {canAssignRoles
          ? "Role changes apply on the person's next request — their session carries no role of its own."
          : "Internal staff can view this list but cannot change roles. Ask an admin for access changes."}
      </p>
    </section>
  );
}
