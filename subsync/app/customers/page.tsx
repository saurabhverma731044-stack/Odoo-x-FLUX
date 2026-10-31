"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Customer = {
  name: string;
  subscriptions: number;
  totalAmount: number;
  active: number;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCustomers() {
      const { data, error } = await supabase
        .from("subscription")
        .select("customer, amount, status");

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const grouped = new Map<string, Customer>();

      (data ?? []).forEach((row) => {
        const name = String(row.customer ?? "Unknown customer");
        const existing = grouped.get(name) ?? {
          name,
          subscriptions: 0,
          totalAmount: 0,
          active: 0,
        };

        existing.subscriptions += 1;
        existing.totalAmount += Number(row.amount ?? 0);

        if (String(row.status).toLowerCase() === "active") {
          existing.active += 1;
        }

        grouped.set(name, existing);
      });

      setCustomers(Array.from(grouped.values()));
      setLoading(false);
    }

    loadCustomers();
  }, []);

  const filtered = useMemo(
    () =>
      customers.filter((customer) =>
        customer.name.toLowerCase().includes(search.toLowerCase())
      ),
    [customers, search]
  );

  const money = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-indigo-600">
            Subscription Management
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Customers
          </h1>
          <p className="mt-2 text-slate-500">
            View customers and their subscription activity.
          </p>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">Total customers</p>
            <p className="mt-2 text-2xl font-bold">{customers.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">Total subscriptions</p>
            <p className="mt-2 text-2xl font-bold">
              {customers.reduce((sum, item) => sum + item.subscriptions, 0)}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">Active subscriptions</p>
            <p className="mt-2 text-2xl font-bold">
              {customers.reduce((sum, item) => sum + item.active, 0)}
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Customer list</h2>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers..."
              className="rounded-lg border px-4 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          {loading ? (
            <p className="p-8 text-sm text-slate-500">
              Loading customers...
            </p>
          ) : error ? (
            <p className="p-8 text-sm text-red-600">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Subscriptions</th>
                    <th className="px-5 py-4">Active</th>
                    <th className="px-5 py-4">Total amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((customer) => (
                    <tr key={customer.name} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-semibold">
                        {customer.name}
                      </td>
                      <td className="px-5 py-4">
                        {customer.subscriptions}
                      </td>
                      <td className="px-5 py-4">{customer.active}</td>
                      <td className="px-5 py-4">
                        {money(customer.totalAmount)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-slate-500"
                      >
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}