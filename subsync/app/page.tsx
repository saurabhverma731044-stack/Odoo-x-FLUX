"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Subscription = {
  id: string;
  customer: string;
  email: string;
  plan: string;
  amount: number;
  status: "Active" | "Pending" | "Overdue" | "Cancelled";
  nextBilling: string;
};

type Payment = {
  id: number;
  amount: number;
  status: string;
  payment_date: string;
};

const navigation = [
  { icon: "▦", label: "Dashboard", path: "/" },
  { icon: "↻", label: "Subscriptions", path: "/subscriptions" },
  { icon: "♙", label: "Customers", path: "/customers" },
  { icon: "▣", label: "Payments", path: "/payments" },
  { icon: "▤", label: "Products", path: "#" },
  { icon: "▥", label: "Reports", path: "#" },
];

const statusStyles: Record<string, string> = {
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

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeStatus(value: unknown): Subscription["status"] {
  const status = String(value || "").toLowerCase();

  if (status.includes("active")) return "Active";
  if (status.includes("pending")) return "Pending";
  if (status.includes("overdue")) return "Overdue";
  if (status.includes("cancel")) return "Cancelled";

  return "Pending";
}

export default function Home() {
  const router = useRouter();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      const [subscriptionResult, paymentResult, customerResult] =
        await Promise.all([
          supabase.from("subscriptions").select("*"),
          supabase.from("payments").select("*"),
          supabase.from("customers").select("id", { count: "exact" }),
        ]);

      if (subscriptionResult.error) {
        setError(subscriptionResult.error.message);
      } else {
        const rows = subscriptionResult.data || [];

        const mapped: Subscription[] = rows.map((row: any) => ({
          id: String(row.id ?? "—"),
          customer: String(
            row.customer ?? row.customer_name ?? "Unknown customer"
          ),
          email: String(row.email ?? ""),
          plan: String(row.plan ?? row.product ?? "Subscription"),
          amount: Number(row.amount ?? 0),
          status: normalizeStatus(row.status),
          nextBilling: formatDate(
            row.next_billing ?? row.nextBilling ?? row.next_payment_date
          ),
        }));

        setSubscriptions(mapped);
      }

      if (paymentResult.error) {
        setError((current) =>
          current
            ? `${current} | ${paymentResult.error.message}`
            : paymentResult.error.message
        );
      } else {
        setPayments((paymentResult.data || []) as Payment[]);
      }

      if (customerResult.error) {
        setError((current) =>
          current
            ? `${current} | ${customerResult.error.message}`
            : customerResult.error.message
        );
      } else {
        setCustomerCount(customerResult.count ?? customerResult.data?.length ?? 0);
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      const text = search.toLowerCase();

      const matchesSearch =
        subscription.customer.toLowerCase().includes(text) ||
        subscription.id.toLowerCase().includes(text) ||
        subscription.plan.toLowerCase().includes(text);

      const matchesStatus =
        statusFilter === "All statuses" ||
        subscription.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, search, statusFilter]);

  const activeCount = subscriptions.filter(
    (item) => item.status === "Active"
  ).length;

  const overdueCount = subscriptions.filter(
    (item) => item.status === "Overdue"
  ).length;

  const monthlyRevenue = payments
    .filter((payment) => {
      const date = new Date(payment.payment_date);
      const now = new Date();

      return (
        payment.status === "Paid" &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const outstanding = payments
    .filter((payment) => payment.status === "Pending")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const monthlyChart = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));

    const total = payments
      .filter((payment) => {
        const paymentDate = new Date(payment.payment_date);

        return (
          payment.status === "Paid" &&
          paymentDate.getMonth() === date.getMonth() &&
          paymentDate.getFullYear() === date.getFullYear()
        );
      })
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      month: date.toLocaleDateString("en-IN", { month: "short" }),
      total,
    };
  });

  const maxRevenue = Math.max(...monthlyChart.map((item) => item.total), 1);

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
              S
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">SubSync</h1>
              <p className="text-xs text-slate-400">
                Subscription management
              </p>
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
                    if (item.path !== "#") router.push(item.path);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    item.label === "Dashboard"
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="w-5 text-center text-lg">
                    {item.icon}
                  </span>
                  {item.label}
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
              <div>
                <p className="text-sm font-semibold">Administrator</p>
                <p className="text-xs text-slate-400">SubSync Workspace</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
            <div>
              <p className="text-xs text-slate-400">Workspace / Overview</p>
              <h2 className="mt-1 text-xl font-bold">Dashboard</h2>
            </div>

            <button
              onClick={() => router.push("/subscriptions")}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              + New subscription
            </button>
          </header>

          <div className="space-y-7 p-5 sm:p-8">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">
                Welcome to SubSync 👋
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Your business overview, updated with Supabase data.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Active subscriptions"
                value={loading ? "..." : activeCount.toLocaleString("en-IN")}
                description="From subscriptions"
                icon="↻"
                iconBg="bg-indigo-50 text-indigo-600"
              />
              <SummaryCard
                title="Monthly revenue"
                value={loading ? "..." : formatCurrency(monthlyRevenue)}
                description="Paid this month"
                icon="₹"
                iconBg="bg-emerald-50 text-emerald-600"
              />
              <SummaryCard
                title="Outstanding amount"
                value={loading ? "..." : formatCurrency(outstanding)}
                description="Pending payments"
                icon="◷"
                iconBg="bg-amber-50 text-amber-600"
              />
              <SummaryCard
                title="Customers"
                value={loading ? "..." : customerCount.toLocaleString("en-IN")}
                description={`${overdueCount} overdue subscriptions`}
                icon="♙"
                iconBg="bg-rose-50 text-rose-600"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div>
                <h3 className="font-bold">Revenue overview</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Paid payments over the last 6 months
                </p>
              </div>

              <div className="mt-6 flex h-44 items-end gap-3 sm:gap-6">
                {monthlyChart.map((bar) => (
                  <div
                    key={bar.month}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-[10px] text-slate-400">
                      {bar.total > 0
                        ? `₹${bar.total.toLocaleString("en-IN")}`
                        : ""}
                    </span>
                    <div
                      className="w-full max-w-16 rounded-t-lg bg-indigo-500 transition hover:bg-indigo-700"
                      style={{
                        height: `${Math.max(
                          bar.total > 0 ? (bar.total / maxRevenue) * 75 : 3,
                          3
                        )}%`,
                      }}
                    />
                    <span className="text-xs text-slate-400">
                      {bar.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-6">
                <div>
                  <h3 className="font-bold">Recent subscriptions</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Live records from your Supabase database
                  </p>
                </div>

                <button
                  onClick={() => router.push("/subscriptions")}
                  className="w-fit text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
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
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-10 text-center text-sm text-slate-400"
                        >
                          Loading subscriptions...
                        </td>
                      </tr>
                    ) : filteredSubscriptions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-10 text-center text-sm text-slate-400"
                        >
                          No subscriptions found.
                        </td>
                      </tr>
                    ) : (
                      filteredSubscriptions.slice(0, 10).map((subscription) => (
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
                                  .join("")
                                  .slice(0, 2)}
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
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                statusStyles[subscription.status]
                              }`}
                            >
                              {subscription.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 px-6 py-4 text-xs text-slate-400">
                Showing {filteredSubscriptions.length} matching subscriptions
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Total customers: {customerCount} · Total payments: {payments.length}
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
  description,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
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
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </div>
  );
}