"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Subscription = {
  id: string;
  customer: string;
  email: string;
  plan: string;
  amount: number;
  status: "Active" | "Pending" | "Overdue" | "Cancelled";
  nextBilling: string;
};

const subscriptions: Subscription[] = [
  {
    id: "SUB-1001",
    customer: "Aarav Sharma",
    email: "aarav@example.com",
    plan: "Pro Monthly",
    amount: 2499,
    status: "Active",
    nextBilling: "Nov 05, 2026",
  },
  {
    id: "SUB-1002",
    customer: "Meera Kapoor",
    email: "meera@example.com",
    plan: "Starter Monthly",
    amount: 999,
    status: "Pending",
    nextBilling: "Nov 06, 2026",
  },
  {
    id: "SUB-1003",
    customer: "Rohan Verma",
    email: "rohan@example.com",
    plan: "Business Yearly",
    amount: 24999,
    status: "Overdue",
    nextBilling: "Oct 28, 2026",
  },
  {
    id: "SUB-1004",
    customer: "Isha Singh",
    email: "isha@example.com",
    plan: "Pro Monthly",
    amount: 2499,
    status: "Active",
    nextBilling: "Nov 12, 2026",
  },
  {
    id: "SUB-1005",
    customer: "Kabir Malhotra",
    email: "kabir@example.com",
    plan: "Starter Monthly",
    amount: 999,
    status: "Cancelled",
    nextBilling: "—",
  },
];

const navigation = [
  { icon: "▦", label: "Dashboard" },
  { icon: "↻", label: "Subscriptions" },
  { icon: "♙", label: "Customers" },
  { icon: "▣", label: "Products" },
  { icon: "▤", label: "Invoices" },
  { icon: "▥", label: "Reports" },
];

const statusStyles: Record<Subscription["status"], string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Overdue: "bg-rose-50 text-rose-700",
  Cancelled: "bg-slate-100 text-slate-500",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [activeNav, setActiveNav] = useState("Dashboard");

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const matchesSearch =
        subscription.customer.toLowerCase().includes(search.toLowerCase()) ||
        subscription.id.toLowerCase().includes(search.toLowerCase()) ||
        subscription.plan.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All statuses" ||
        subscription.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
              S
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">SubSync</h1>
              <p className="text-xs text-slate-400">Subscription management</p>
            </div>
          </div>

          <div className="px-4 py-6">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Workspace
            </p>

            <nav className="space-y-1">
              {navigation.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
  if (item.label === "Subscriptions") {
    router.push("/subscriptions");
  } else if (item.label === "Dashboard") {
    router.push("/");
  } else {
    setActiveNav(item.label);
  }
}}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    activeNav === item.label
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="w-5 text-center text-lg">{item.icon}</span>
                  {item.label}
                  {item.label === "Invoices" && (
                    <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-600">
                      4
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto border-t border-slate-100 p-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">Need help?</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Get help managing your subscriptions.
              </p>
              <button className="mt-3 text-xs font-semibold text-indigo-600">
                Contact support →
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 px-2 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                SV
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Saurabh Verma</p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
              <span className="ml-auto text-slate-400">⌄</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
            <div>
              <p className="text-xs text-slate-400">Workspace / Overview</p>
              <h2 className="mt-1 text-xl font-bold">Dashboard</h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                aria-label="Notifications"
                className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50"
              >
                ♧
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
              </button>
              <button className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
                + New subscription
              </button>
            </div>
          </header>

          <div className="space-y-7 p-5 sm:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h3 className="text-2xl font-bold tracking-tight">
                  Welcome back, Saurabh 👋
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Here&apos;s what&apos;s happening with your business today.
                </p>
              </div>

              <button className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                ▦ &nbsp; October 2026
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Active subscriptions"
                value="1,248"
                change="+12.8%"
                description="vs. last month"
                icon="↻"
                iconBg="bg-indigo-50 text-indigo-600"
              />
              <SummaryCard
                title="Monthly revenue"
                value="₹8,42,500"
                change="+8.2%"
                description="vs. last month"
                icon="₹"
                iconBg="bg-emerald-50 text-emerald-600"
              />
              <SummaryCard
                title="Outstanding amount"
                value="₹1,24,800"
                change="12 invoices"
                description="awaiting payment"
                icon="◷"
                iconBg="bg-amber-50 text-amber-600"
              />
              <SummaryCard
                title="Overdue invoices"
                value="18"
                change="Needs attention"
                description="payment overdue"
                icon="!"
                iconBg="bg-rose-50 text-rose-600"
              />
            </div>

            {/* Revenue chart placeholder */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-bold">Revenue overview</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Revenue collected over the last 6 months
                  </p>
                </div>
                <span className="w-fit rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                  Last 6 months⌄
                </span>
              </div>

              <div className="mt-6 flex h-44 items-end gap-3 sm:gap-6">
                {[
                  { month: "May", height: "42%" },
                  { month: "Jun", height: "58%" },
                  { month: "Jul", height: "48%" },
                  { month: "Aug", height: "76%" },
                  { month: "Sep", height: "65%" },
                  { month: "Oct", height: "92%" },
                ].map((bar) => (
                  <div
                    key={bar.month}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div
                      className="w-full max-w-16 rounded-t-lg bg-indigo-500 transition hover:bg-indigo-700"
                      style={{ height: bar.height }}
                    />
                    <span className="text-xs text-slate-400">{bar.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-6">
                <div>
                  <h3 className="font-bold">Recent subscriptions</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Manage and track your latest subscriptions
                  </p>
                </div>

                <button className="w-fit text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                  View all →
                </button>
              </div>

              <div className="flex flex-col gap-3 p-4 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customer, plan or ID..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:max-w-sm"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-indigo-400"
                >
                  <option>All statuses</option>
                  <option>Active</option>
                  <option>Pending</option>
                  <option>Overdue</option>
                  <option>Cancelled</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Customer</th>
                      <th className="px-6 py-3 font-semibold">Plan</th>
                      <th className="px-6 py-3 font-semibold">Amount</th>
                      <th className="px-6 py-3 font-semibold">Next billing</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold"> </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredSubscriptions.map((subscription) => (
                      <tr
                        key={subscription.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                              {subscription.customer
                                .split(" ")
                                .map((part) => part[0])
                                .join("")}
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                {subscription.customer}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {subscription.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {subscription.plan}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold">
                          {formatCurrency(subscription.amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {subscription.nextBilling}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[subscription.status]}`}
                          >
                            {subscription.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400">
                          ···
                        </td>
                      </tr>
                    ))}

                    {filteredSubscriptions.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-10 text-center text-sm text-slate-400"
                        >
                          No subscriptions match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 px-6 py-4 text-xs text-slate-400">
                Showing {filteredSubscriptions.length} of{" "}
                {subscriptions.length} demo subscriptions
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  change,
  description,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  change: string;
  description: string;
  icon: string;
  iconBg: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${iconBg}`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-emerald-600">{change}</span>
        <span className="text-slate-400">{description}</span>
      </div>
    </div>
  );
}