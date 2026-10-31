
"use client";

import { useMemo, useState } from "react";

type Subscription = {
  id: string;
  customer: string;
  plan: string;
  amount: number;
  status: "Active" | "Trial" | "Cancelled" | "Past Due";
  nextBilling: string;
};

const subscriptions: Subscription[] = [
  {
    id: "SUB-1001",
    customer: "Aarav Sharma",
    plan: "Pro",
    amount: 1499,
    status: "Active",
    nextBilling: "Nov 05, 2026",
  },
  {
    id: "SUB-1002",
    customer: "Meera Kapoor",
    plan: "Starter",
    amount: 499,
    status: "Trial",
    nextBilling: "Nov 08, 2026",
  },
  {
    id: "SUB-1003",
    customer: "Rohan Verma",
    plan: "Enterprise",
    amount: 4999,
    status: "Past Due",
    nextBilling: "Oct 29, 2026",
  },
  {
    id: "SUB-1004",
    customer: "Ananya Singh",
    plan: "Pro",
    amount: 1499,
    status: "Cancelled",
    nextBilling: "—",
  },
  {
    id: "SUB-1005",
    customer: "Kabir Khan",
    plan: "Starter",
    amount: 499,
    status: "Active",
    nextBilling: "Nov 12, 2026",
  },
];

const statusStyles: Record<Subscription["status"], string> = {
  Active: "bg-green-100 text-green-700",
  Trial: "bg-blue-100 text-blue-700",
  Cancelled: "bg-gray-100 text-gray-600",
  "Past Due": "bg-red-100 text-red-700",
};

export default function SubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const matchesSearch =
        subscription.customer.toLowerCase().includes(search.toLowerCase()) ||
        subscription.id.toLowerCase().includes(search.toLowerCase()) ||
        subscription.plan.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || subscription.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">
              Subscription Management
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Subscriptions
            </h1>
            <p className="mt-2 text-slate-500">
              Manage customer plans, billing, and subscription status.
            </p>
          </div>

          <button
            onClick={() => alert("Create subscription form coming next!")}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            + New Subscription
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total Subscriptions", subscriptions.length],
            [
              "Active",
              subscriptions.filter((item) => item.status === "Active").length,
            ],
            [
              "Trial",
              subscriptions.filter((item) => item.status === "Trial").length,
            ],
            [
              "Past Due",
              subscriptions.filter((item) => item.status === "Past Due").length,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              All subscriptions
            </h2>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer, ID, or plan..."
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-indigo-500"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-indigo-500"
              >
                <option>All</option>
                <option>Active</option>
                <option>Trial</option>
                <option>Cancelled</option>
                <option>Past Due</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Subscription ID</th>
                  <th className="px-5 py-4 font-medium">Customer</th>
                  <th className="px-5 py-4 font-medium">Plan</th>
                  <th className="px-5 py-4 font-medium">Amount / month</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Next billing</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredSubscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-indigo-600">
                      {subscription.id}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-800">
                      {subscription.customer}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {subscription.plan}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatAmount(subscription.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[subscription.status]}`}
                      >
                        {subscription.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {subscription.nextBilling}
                    </td>
                  </tr>
                ))}

                {filteredSubscriptions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      No subscriptions match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
