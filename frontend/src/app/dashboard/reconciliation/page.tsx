"use client";

import { useEffect, useState } from "react";
import { useReconciliationStore } from "@/stores/useReconciliationStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import Link from "next/link";

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-2 border-b last:border-0 ${highlight ? "font-semibold" : ""}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${highlight ? "text-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

export default function ReconciliationPage() {
  const { currency } = useCurrencyStore();
  const fmt = (n: number) => `${currency.symbol} ${n.toLocaleString("en-KE", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })}`;
  const {
    currentReport, savedReports, isGenerating, isSubmitting, isLoading,
    generateReport, setActualCash, setDiscrepancyNotes, submitReport, listReports, clearReport,
    error,
  } = useReconciliationStore();

  const { subscription } = useSubscriptionStore();
  const hasEnterprise = subscription?.plan === "ENTERPRISE";

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    return () => { clearReport(); };
  }, []);

  const handleGenerate = () => {
    setSubmitted(false);
    setSubmitError("");
    generateReport(selectedDate);
  };

  const handleSubmit = async () => {
    setSubmitError("");
    try {
      await submitReport();
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShowHistory = async () => {
    setShowHistory(true);
    await listReports();
  };

  if (!hasEnterprise) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-6xl mb-4">🧾</div>
        <h2 className="text-2xl font-bold mb-2">End-of-Day Reconciliation — ENTERPRISE Plan Feature</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Generate daily reconciliation reports with cash discrepancy tracking, COGS, gross profit, and void summaries. Upgrade to the ENTERPRISE plan to access End-of-Day.
        </p>
        <Link href="/dashboard/subscription" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
          View Plans & Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">End-of-Day Reconciliation</h1>
        <button
          onClick={handleShowHistory}
          className="text-sm text-primary hover:underline"
        >
          View History →
        </button>
      </div>

      {/* Date Picker + Generate */}
      <section className="rounded-lg border p-5 space-y-4">
        <h2 className="text-base font-semibold">Generate Report</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-sm font-medium block mb-1">Report Date</label>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => { setSelectedDate(e.target.value); clearReport(); setSubmitted(false); }}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {isGenerating ? "Generating…" : "Generate"}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {currentReport && (
        <>
          {/* Payment Summary */}
          <section className="rounded-lg border p-5">
            <h2 className="text-base font-semibold mb-3">Payment Summary — {new Date(currentReport.reportDate).toLocaleDateString("en-KE", { dateStyle: "long" })}</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <SummaryRow label="Cash" value={fmt(currentReport.totalCash)} />
                <SummaryRow label="Mobile Money (M-Pesa)" value={fmt(currentReport.totalMobileMoney)} />
                <SummaryRow label="Card" value={fmt(currentReport.totalCard)} />
                <SummaryRow label="Cheque" value={fmt(currentReport.totalCheque)} />
                <SummaryRow label="Bank Transfer" value={fmt(currentReport.totalBankTransfer)} />
                <SummaryRow label="Credit (Deferred)" value={fmt(currentReport.totalCredit)} />
                <SummaryRow label="Total Revenue" value={fmt(currentReport.totalRevenue)} highlight />
              </div>
              <div>
                <SummaryRow label="Transactions" value={currentReport.transactionCount.toLocaleString()} />
                <SummaryRow label="Voided Transactions" value={currentReport.voidCount.toLocaleString()} />
                <SummaryRow label="Void Amount" value={fmt(currentReport.voidTotal)} />
                <SummaryRow label="Total COGS" value={fmt(currentReport.totalCOGS)} />
                <SummaryRow label="Gross Profit" value={fmt(currentReport.grossProfit)} highlight />
                {currentReport.totalRevenue > 0 && (
                  <SummaryRow
                    label="Profit Margin"
                    value={`${((currentReport.grossProfit / currentReport.totalRevenue) * 100).toFixed(1)}%`}
                    highlight
                  />
                )}
              </div>
            </div>
          </section>

          {/* Cash Reconciliation */}
          <section className="rounded-lg border p-5 space-y-4">
            <h2 className="text-base font-semibold">Cash Reconciliation</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Expected Cash (from system)</p>
                  <p className="text-2xl font-bold">{fmt(currentReport.expectedCash)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Actual Cash Count (KES)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                    value={currentReport.actualCash ?? ""}
                    onChange={(e) => setActualCash(parseFloat(e.target.value) || 0)}
                  />
                </div>
                {currentReport.actualCash !== undefined && (
                  <div className={`rounded-md p-3 ${(currentReport.cashDiscrepancy ?? 0) === 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <p className="text-sm font-medium">
                      Discrepancy: {" "}
                      <span className={(currentReport.cashDiscrepancy ?? 0) >= 0 ? "text-green-700" : "text-red-700"}>
                        {(currentReport.cashDiscrepancy ?? 0) >= 0 ? "+" : ""}
                        {fmt(currentReport.cashDiscrepancy ?? 0)}
                      </span>
                    </p>
                    {(currentReport.cashDiscrepancy ?? 0) === 0 && (
                      <p className="text-xs text-green-600 mt-1">Cash balanced perfectly.</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Discrepancy Notes</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={5}
                  placeholder="Explain any discrepancy (optional)…"
                  value={currentReport.discrepancyNotes ?? ""}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Voided Transactions */}
          {currentReport.voidedTransactions.length > 0 && (
            <section className="rounded-lg border p-5">
              <h2 className="text-base font-semibold mb-3">Voided Transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Transaction #</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentReport.voidedTransactions.map((v) => (
                      <tr key={v.transactionNo} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{v.transactionNo}</td>
                        <td className="p-3 text-right text-red-600">{fmt(v.totalAmount)}</td>
                        <td className="p-3 text-muted-foreground">{v.voidReason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Actions */}
          {!submitted ? (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handlePrint}
                className="px-5 py-2 rounded-md border text-sm font-medium hover:bg-muted"
              >
                Print Report
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting ? "Submitting…" : "Submit & Close Day"}
              </button>
              {submitError && <p className="text-sm text-destructive self-center">{submitError}</p>}
            </div>
          ) : (
            <div className="rounded-md bg-green-50 border border-green-200 p-4">
              <p className="text-sm font-semibold text-green-700">Report submitted successfully.</p>
              <p className="text-xs text-green-600 mt-1">End of day for {new Date(currentReport.reportDate).toLocaleDateString()} is closed.</p>
            </div>
          )}
        </>
      )}

      {/* History */}
      {showHistory && (
        <section className="rounded-lg border p-5">
          <h2 className="text-base font-semibold mb-3">Report History</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : savedReports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Submitted By</th>
                    <th className="text-right p-3 font-medium">Revenue</th>
                    <th className="text-right p-3 font-medium">Transactions</th>
                    <th className="text-right p-3 font-medium">Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {savedReports.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="p-3">{new Date(r.reportDate).toLocaleDateString()}</td>
                      <td className="p-3">{r.user?.name ?? r.submittedBy}</td>
                      <td className="p-3 text-right font-semibold">{fmt(Number(r.totalRevenue))}</td>
                      <td className="p-3 text-right">{r.transactionCount}</td>
                      <td className={`p-3 text-right ${(r.cashDiscrepancy ?? 0) !== 0 ? "text-red-600" : "text-green-600"}`}>
                        {r.cashDiscrepancy != null ? fmt(Number(r.cashDiscrepancy)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No saved reports yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
