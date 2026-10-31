"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Payment = {
  id: number;
  customer_id: number | null;
  subscription_id: number | null;
  amount: number;
  payment_date: string;
  status: "Paid" | "Pending" | "Failed";
  payment_method: string | null;
};

type Customer = {
  id: number;
  name: string;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("Paid");
  const [method, setMethod] = useState("UPI");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [paymentResult, customerResult] = await Promise.all([
      supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false }),
      supabase.from("customers").select("id, name").order("name"),
    ]);

    if (paymentResult.error) {
      setError(paymentResult.error.message);
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
      setCustomers((customerResult.data || []) as Customer[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const { error: insertError } = await supabase.from("payments").insert({
      customer_id: customerId ? Number(customerId) : null,
      amount: Number(amount),
      status,
      payment_method: method,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setMessage("Payment added successfully!");
      setCustomerId("");
      setAmount("");
      setStatus("Paid");
      setMethod("UPI");
      await loadData();
    }

    setSaving(false);
  }

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const customer =
        customers.find((item) => item.id === payment.customer_id)?.name ||
        "Unknown customer";

      const matchesSearch =
        customer.toLowerCase().includes(search.toLowerCase()) ||
        String(payment.id).includes(search);

      const matchesStatus =
        filter === "All" || payment.status === filter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, customers, search, filter]);

  const collected = payments
    .filter((p) => p.status === "Paid")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pending = payments
    .filter((p) => p.status === "Pending")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalAmount = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-cyan-400">SUBSYNC / BILLING</p>
            <h1 className="mt-2 text-3xl font-bold">Payments</h1>
            <p className="mt-1 text-slate-400">
              Manage payment history and collections.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat title="Total Payments" value={payments.length.toString()} />
          <Stat
            title="Collected"
            value={`₹${collected.toLocaleString("en-IN")}`}
          />
          <Stat
            title="Pending"
            value={`₹${pending.toLocaleString("en-IN")}`}
          />
        </div>

        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-5 text-xl font-semibold">Add New Payment</h2>

          <form onSubmit={addPayment} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Customer
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
              >
                <option value="">No customer selected</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Amount (₹)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Payment Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
              >
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 md:col-span-2"
            >
              {saving ? "Saving..." : "Add Payment"}
            </button>
          </form>

          {message && (
            <p className="mt-4 text-sm text-emerald-400">{message}</p>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-400">{error}</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-5 text-xl font-semibold">Payment History</h2>

          <div className="mb-5 flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer or payment ID..."
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-slate-400">
              Loading payments...
            </p>
          ) : error ? (
            <p className="py-10 text-center text-red-400">{error}</p>
          ) : filteredPayments.length === 0 ? (
            <p className="py-10 text-center text-slate-400">
              No payments found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-slate-800">
                    <th className="p-3">Payment ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-800/70 hover:bg-slate-800/40"
                    >
                      <td className="p-3">#{payment.id}</td>
                      <td className="p-3">
                        {customers.find(
                          (c) => c.id === payment.customer_id
                        )?.name || "Unknown customer"}
                      </td>
                      <td className="p-3">
                        {new Date(payment.payment_date).toLocaleDateString(
                          "en-IN"
                        )}
                      </td>
                      <td className="p-3">
                        ₹{Number(payment.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3">
                        {payment.payment_method || "—"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            payment.status === "Paid"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : payment.status === "Failed"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-4 text-xs text-slate-500">
          Total payment value: ₹{totalAmount.toLocaleString("en-IN")}
        </p>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}