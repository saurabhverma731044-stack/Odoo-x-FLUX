
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Subscription = {
  id: string;
  customer: string;
  plan: string;
  amount: number;
  status: "Active" | "Trial" | "Cancelled" | "Past Due";
  nextBilling: string;
};

const statusStyles: Record<Subscription["status"], string> = {
  Active: "bg-green-100 text-green-700",
  Trial: "bg-blue-100 text-blue-700",
  Cancelled: "bg-gray-100 text-gray-600",
  "Past Due": "bg-red-100 text-red-700",
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customer, setCustomer] = useState("");
  const [plan, setPlan] = useState("Starter");
  const [amount, setAmount] = useState("499");
  const [status, setStatus] = useState<"Active" | "Trial">("Active");
  const [nextBilling, setNextBilling] = useState("");

  // Load subscriptions from Supabase
  useEffect(() => {
    async function loadSubscriptions() {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const formattedData: Subscription[] = (data ?? []).map((item) => ({
        id: item.subscription_id,
        customer: item.customer,
        plan: item.plan,
        amount: Number(item.amount),
        status: item.status as Subscription["status"],
        nextBilling: item.next_billing
          ? new Date(`${item.next_billing}T00:00:00`).toLocaleDateString(
              "en-US",
              { month: "short", day: "2-digit", year: "numeric" }
            )
          : "—",
      }));

      setSubscriptions(formattedData);
      setLoading(false);
    }

    loadSubscriptions();
  }, []);

  // Search and filter
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
  }, [subscriptions, search, statusFilter]);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  // Save new subscription to Supabase
  async function handleCreateSubscription(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const subscriptionId = `SUB-${Date.now()}`;

    const { data, error } = await supabase
      .from("subscriptions")
      .insert([
        {
          subscription_id: subscriptionId,
          customer: customer.trim(),
          plan,
          amount: Number(amount),
          status,
          next_billing: nextBilling,
        },
      ])
      .select()
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    const newSubscription: Subscription = {
      id: data.subscription_id,
      customer: data.customer,
      plan: data.plan,
      amount: Number(data.amount),
      status: data.status as Subscription["status"],
      nextBilling: data.next_billing
        ? new Date(`${data.next_billing}T00:00:00`).toLocaleDateString(
            "en-US",
            { month: "short", day: "2-digit", year: "numeric" }
          )
        : "—",
    };

    setSubscriptions((previous) => [newSubscription, ...previous]);

    setCustomer("");
    setPlan("Starter");
    setAmount("499");
    setStatus("Active");
    setNextBilling("");
    setSearch("");
    setStatusFilter("All");
    setShowForm(false);
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        {/* Page heading */}
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
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            + New Subscription
          </button>
        </div>

        {/* Loading and error messages */}
        {loading && (
          <p className="mb-4 text-sm text-slate-500">
            Loading subscriptions...
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Summary cards */}
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

        {/* Subscriptions table */}
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

                {!loading && filteredSubscriptions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      No subscriptions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* New subscription modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Create Subscription
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the customer and plan details.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-2 text-xl text-slate-400 hover:bg-slate-100"
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Customer name
                </label>
                <input
                  required
                  value={customer}
                  onChange={(event) => setCustomer(event.target.value)}
                  placeholder="Enter customer name"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Plan
                </label>
                <select
                  value={plan}
                  onChange={(event) => {
                    setPlan(event.target.value);
                    setAmount(
                      event.target.value === "Starter"
                        ? "499"
                        : event.target.value === "Pro"
                          ? "1499"
                          : "4999"
                    );
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="Starter">Starter</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Amount (₹ / month)
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as "Active" | "Trial")
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="Active">Active</option>
                  <option value="Trial">Trial</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Next billing date
                </label>
                <input
                  required
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={nextBilling}
                  onChange={(event) => setNextBilling(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Create Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
