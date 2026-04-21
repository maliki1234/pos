"use client";

import { useEffect, useState, useCallback } from "react";
import { useCreditStore } from "@/stores/useCreditStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

const statusColors: Record<string, string> = {
  OUTSTANDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  PARTIAL:     "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  SETTLED:     "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  OVERDUE:     "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function AgingCard({ title, count, total, color, fmtFn }: {
  title: string; count: number; total: number; color: string; fmtFn: (n: number) => string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-1">{fmtFn(total)}</p>
      <p className="text-sm mt-1">{count} {count === 1 ? "entry" : "entries"}</p>
    </div>
  );
}

export default function CreditLedgerPage() {
  const { currency } = useCurrencyStore();
  const fmt = (n: number) => `${currency.symbol} ${n.toLocaleString("en-KE", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })}`;
  const { token, user } = useAuthStore();
  const { agingReport, ledgerEntries, isLoading, fetchAgingReport, fetchCustomerLedger, recordRepayment } = useCreditStore();
  const { subscription } = useSubscriptionStore();
  const plan = subscription?.plan ?? "STARTER";
  const hasBusiness = plan === "BUSINESS" || plan === "ENTERPRISE";

  // All-customers search state
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  // Per-customer lookup state
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Repayment dialog
  const [repayDialog, setRepayDialog] = useState<{ open: boolean; ledgerId: string; max: number; customerName: string }>({
    open: false, ledgerId: "", max: 0, customerName: "",
  });
  const [repayAmount, setRepayAmount] = useState("");
  const [repayMethod, setRepayMethod] = useState("CASH");
  const [repayNotes, setRepayNotes] = useState("");
  const [repayError, setRepayError] = useState("");

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  useEffect(() => { fetchAgingReport(); }, [fetchAgingReport]);

  // Load all outstanding on mount
  useEffect(() => {
    if (!hasBusiness) return;
    loadAllCredit("");
  }, [hasBusiness]);

  const loadAllCredit = async (q: string) => {
    setAllLoading(true);
    try {
      const res = await fetch(`${API}/credit/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setAllEntries(d.data ?? []); }
    } catch {}
    setAllLoading(false);
  };

  const handleSearchAll = (q: string) => {
    setSearchQ(q);
    loadAllCredit(q);
  };

  // Customer autocomplete
  const handleCustomerSearch = async (val: string) => {
    setCustomerSearch(val);
    if (!val.trim()) { setCustomerResults([]); return; }
    try {
      const res = await fetch(`${API}/customers?search=${encodeURIComponent(val)}&take=8`, { headers: authHeaders() });
      if (res.ok) { const d = await res.json(); setCustomerResults(d.data ?? []); }
    } catch {}
  };

  const handleSelectCustomer = async (c: any) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setCustomerResults([]);
    const result = await fetchCustomerLedger(c.id);
    setTotalOutstanding(result.totalOutstanding);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerResults([]);
    setTotalOutstanding(0);
  };

  const handleRepay = async () => {
    setRepayError("");
    const amount = parseFloat(repayAmount);
    if (!amount || amount <= 0) { setRepayError("Enter a valid amount"); return; }
    if (amount > repayDialog.max) { setRepayError(`Cannot exceed outstanding balance of ${fmt(repayDialog.max)}`); return; }
    try {
      await recordRepayment(repayDialog.ledgerId, amount, repayMethod, repayNotes);
      setRepayDialog({ open: false, ledgerId: "", max: 0, customerName: "" });
      setRepayAmount(""); setRepayNotes("");
      // Refresh views
      loadAllCredit(searchQ);
      if (selectedCustomer) {
        const result = await fetchCustomerLedger(selectedCustomer.id);
        setTotalOutstanding(result.totalOutstanding);
      }
    } catch (e: any) { setRepayError(e.message); }
  };

  const openRepay = (ledgerId: string, max: number, customerName: string) => {
    setRepayDialog({ open: true, ledgerId, max, customerName });
    setRepayAmount(""); setRepayNotes(""); setRepayError("");
  };

  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return <div className="p-6 text-destructive">Access denied. ADMIN or MANAGER role required.</div>;
  }

  if (!hasBusiness) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-6xl mb-4">💳</div>
        <h2 className="text-2xl font-bold mb-2">Credit Ledger — BUSINESS Plan Feature</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Track customer credit sales, record repayments, and monitor outstanding balances with aging reports.
        </p>
        <Link href="/dashboard/subscription" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90">
          View Plans & Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Credit Ledger</h1>

      {/* Aging report */}
      {agingReport && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Aging Report</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AgingCard title="0–30 Days" count={agingReport.current.count} total={agingReport.current.totalOutstanding} color="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20" fmtFn={fmt} />
            <AgingCard title="31–60 Days" count={agingReport.thirtyToSixty.count} total={agingReport.thirtyToSixty.totalOutstanding} color="bg-orange-50 border-orange-200 dark:bg-orange-950/20" fmtFn={fmt} />
            <AgingCard title="60+ Days Overdue" count={agingReport.overSixty.count} total={agingReport.overSixty.totalOutstanding} color="bg-red-50 border-red-200 dark:bg-red-950/20" fmtFn={fmt} />
            <AgingCard title="No Due Date" count={agingReport.noDueDate.count} total={agingReport.noDueDate.totalOutstanding} color="bg-gray-50 border-gray-200 dark:bg-gray-800/30" fmtFn={fmt} />
          </div>
        </section>
      )}

      {/* ── ALL OUTSTANDING CREDIT ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">All Outstanding Credit</h2>
          <span className="text-sm text-muted-foreground">{allEntries.length} entries</span>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full border rounded-md pl-9 pr-4 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search by customer name or phone…"
            value={searchQ}
            onChange={e => handleSearchAll(e.target.value)}
          />
        </div>

        {allLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : allEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No outstanding credit entries{searchQ ? " matching your search" : ""}.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium">Transaction</th>
                  <th className="text-right p-3 font-medium">Original</th>
                  <th className="text-right p-3 font-medium">Outstanding</th>
                  <th className="text-left p-3 font-medium">Due Date</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allEntries.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-medium">{entry.customer?.name ?? "—"}</p>
                      {entry.customer?.phone && <p className="text-xs text-muted-foreground">{entry.customer.phone}</p>}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {entry.transaction?.transactionNo ?? entry.id.slice(0, 8) + "…"}
                    </td>
                    <td className="p-3 text-right">{fmt(parseFloat(entry.originalAmount))}</td>
                    <td className="p-3 text-right font-semibold text-destructive">{fmt(parseFloat(entry.outstandingBalance))}</td>
                    <td className="p-3 text-xs">
                      {entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status]}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        className="text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 font-medium"
                        onClick={() => openRepay(entry.id, parseFloat(entry.outstandingBalance), entry.customer?.name ?? "")}
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── PER-CUSTOMER LEDGER ── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Customer Ledger Detail</h2>

        {/* Customer autocomplete */}
        <div className="relative mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full border rounded-md pl-9 pr-10 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search customer by name or phone…"
              value={customerSearch}
              onChange={e => handleCustomerSearch(e.target.value)}
            />
            {selectedCustomer && (
              <button onClick={clearCustomer} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {customerResults.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg">
              {customerResults.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCustomer(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-muted text-sm border-b last:border-0"
                >
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone ?? c.email ?? "No contact"}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCustomer && (
          <>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-base">{selectedCustomer.name}</span>
              <span className={`${totalOutstanding > 0 ? "text-destructive font-semibold" : "text-green-600"}`}>
                Total outstanding: {fmt(totalOutstanding)}
              </span>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : ledgerEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No credit entries for this customer.</p>
            ) : (
              <div className="space-y-2">
                {ledgerEntries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status]}`}>{entry.status}</span>
                        <span className="text-sm font-mono text-muted-foreground">{entry.transactionId.slice(0, 8)}…</span>
                        {entry.dueDate && (
                          <span className="text-xs text-muted-foreground">{new Date(entry.dueDate).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-destructive">{fmt(entry.outstandingBalance)}</span>
                        {entry.status !== "SETTLED" && (
                          <button
                            className="text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 font-medium"
                            onClick={e => { e.stopPropagation(); openRepay(entry.id, entry.outstandingBalance, selectedCustomer.name); }}
                          >
                            Pay
                          </button>
                        )}
                        {expandedEntry === entry.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {expandedEntry === entry.id && (
                      <div className="border-t px-4 py-3 bg-muted/20 text-sm space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Original:</span><span>{fmt(entry.originalAmount)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span className="text-green-600">{fmt(entry.amountPaid)}</span></div>
                        <div className="flex justify-between font-semibold"><span>Outstanding:</span><span className="text-destructive">{fmt(entry.outstandingBalance)}</span></div>
                        {entry.repayments && entry.repayments.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Payment history</p>
                            {entry.repayments.map((r: any) => (
                              <div key={r.id} className="flex justify-between text-xs py-0.5">
                                <span>{new Date(r.createdAt).toLocaleDateString()} · {r.paymentMethod}</span>
                                <span className="text-green-600 font-medium">+{fmt(r.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Repayment Dialog */}
      {repayDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div>
              <h3 className="text-lg font-semibold">Record Payment</h3>
              {repayDialog.customerName && (
                <p className="text-sm text-muted-foreground">Customer: <strong>{repayDialog.customerName}</strong></p>
              )}
              <p className="text-sm text-muted-foreground">Outstanding: <strong className="text-destructive">{fmt(repayDialog.max)}</strong></p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Amount</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="flex-1 border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                    value={repayAmount}
                    onChange={e => setRepayAmount(e.target.value)}
                    max={repayDialog.max}
                  />
                  <button
                    className="px-3 py-2 text-xs rounded-md border hover:bg-muted"
                    onClick={() => setRepayAmount(String(repayDialog.max))}
                  >
                    Full
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Payment Method</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={repayMethod}
                  onChange={e => setRepayMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="MOBILE_MONEY">Mobile Money (M-Pesa)</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Notes (optional)</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={2}
                  value={repayNotes}
                  onChange={e => setRepayNotes(e.target.value)}
                  placeholder="e.g. Receipt #1234"
                />
              </div>
            </div>

            {repayError && <p className="text-sm text-destructive">{repayError}</p>}

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 text-sm rounded-md border hover:bg-muted"
                onClick={() => setRepayDialog({ open: false, ledgerId: "", max: 0, customerName: "" })}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                onClick={handleRepay}
                disabled={isLoading}
              >
                {isLoading ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
