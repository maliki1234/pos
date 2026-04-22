"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSubscriptionStore, type SubscriptionPayment } from "@/stores/useSubscriptionStore";
import { useCurrencyStore, EA_CURRENCIES } from "@/stores/useCurrencyStore";
import { Check, Zap, Building2, Rocket, AlertTriangle, Clock, RefreshCw } from "lucide-react";

// ── Plan definitions ────────────────────────────────────────────────────────
const PLAN_MONTHLY_KES: Record<string, number> = { STARTER: 0, BUSINESS: 2500, ENTERPRISE: 7500 };

// Features shown per plan — only what's NEW vs the previous tier
const PLAN_TAGLINE: Record<string, string> = {
  STARTER:    "Everything you need to start selling",
  BUSINESS:   "Everything in STARTER, plus:",
  ENTERPRISE: "Everything in BUSINESS, plus:",
};
const PLAN_FEATURES: Record<string, string[]> = {
  STARTER: [
    "Point of Sale (offline-first)",
    "Up to 3 staff accounts",
    "Up to 500 products",
    "Basic receipts & transaction history",
    "Stock management & reorder alerts",
    "Expiry date tracking",
  ],
  BUSINESS: [
    "Unlimited staff accounts",
    "Unlimited products",
    "Analytics dashboard (sales, trends)",
    "Credit ledger & repayment tracking",
    "Customer loyalty points & tiers",
    "Low stock & expiry alerts via SMS",
    "CSV export of any report",
  ],
  ENTERPRISE: [
    "End-of-day cash reconciliation",
    "Profit margin & COGS reports",
    "Staff performance analytics",
    "Multi-branch support",
    "Custom receipt branding",
    "Priority support & account manager",
  ],
};
const PLAN_ICONS: Record<string, any> = { STARTER: Zap, BUSINESS: Building2, ENTERPRISE: Rocket };
const PLAN_COLORS: Record<string, string> = {
  STARTER: "border-gray-200",
  BUSINESS: "border-primary shadow-md",
  ENTERPRISE: "border-purple-400",
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-100 text-green-800",
  INACTIVE:  "bg-gray-100 text-gray-700",
  EXPIRED:   "bg-red-100 text-red-700",
  SUSPENDED: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-red-100 text-red-800",
};
const PAY_STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-700",
  FAILED:    "bg-red-100 text-red-700",
  REFUNDED:  "bg-gray-100 text-gray-600",
};
const PAYMENT_METHODS = ["MPESA", "MTN_MOMO", "TIGO_PESA", "CARD", "BANK_TRANSFER", "CASH"];
const METHOD_LABELS: Record<string, string> = {
  MPESA: "M-Pesa", MTN_MOMO: "MTN MoMo", TIGO_PESA: "Tigo Pesa",
  CARD: "Card", BANK_TRANSFER: "Bank Transfer", CASH: "Cash",
};

function fmtAmt(n: number, curr: string) {
  const cfg = EA_CURRENCIES[curr] ?? EA_CURRENCIES.KES;
  return `${cfg.symbol} ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: cfg.decimals, maximumFractionDigits: cfg.decimals })}`;
}

function planPrice(plan: string, billingCycle: "monthly" | "annual", currency: string) {
  const multipliers: Record<string, number> = { KES: 1, UGX: 38, TZS: 23.2, RWF: 11.2, ETB: 5.8, SOS: 58, BIF: 288, SSP: 1.32, DJF: 0.74, ERN: 0.062 };
  const base = Math.round(PLAN_MONTHLY_KES[plan] * (multipliers[currency] ?? 1));
  return billingCycle === "annual" && base > 0 ? Math.round(base * 0.8) : base;
}

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const { currency } = useCurrencyStore();
  const {
    subscription, payments,
    fetchCurrent, fetchPayments, changePlan,
    recordPayment, confirmPayment, failPayment, refundPayment,
    suspend, reinstate, cancel,
  } = useSubscriptionStore();

  const [tab, setTab] = useState<"overview" | "payments" | "manage">("overview");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [actionNotes, setActionNotes] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: "", currency: currency.code, paymentMethod: "MPESA",
    reference: "", periodStart: "", periodEnd: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetchCurrent();
    fetchPayments();
  }, []);

  if (!user || user.role !== "ADMIN") {
    return <div className="p-6 text-destructive">Access denied. Admin only.</div>;
  }

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleChangePlan = async (plan: string) => {
    if (plan === subscription?.plan) return;
    setSaving(true);
    try {
      await changePlan(plan, billing, currency.code);
      showToast(`Plan changed to ${plan}`);
    } catch (e: any) { showToast(e.message, false); }
    finally { setSaving(false); }
  };

  const handleConfirm = async (paymentId: string) => {
    setSaving(true);
    try {
      await confirmPayment(paymentId, confirmNotes);
      setConfirmingId(null);
      setConfirmNotes("");
      showToast("Payment confirmed — subscription activated");
    } catch (e: any) { showToast(e.message, false); }
    finally { setSaving(false); }
  };

  const handleFail = async (paymentId: string) => {
    if (!confirm("Mark this payment as failed?")) return;
    await failPayment(paymentId);
    showToast("Payment marked as failed");
  };

  const handleRefund = async (paymentId: string) => {
    if (!confirm("Mark this payment as refunded?")) return;
    await refundPayment(paymentId);
    showToast("Payment marked as refunded");
  };

  const handleRecordPayment = async () => {
    if (!payForm.amount || !payForm.periodStart || !payForm.periodEnd) return;
    setSaving(true);
    try {
      await recordPayment({
        amount: parseFloat(payForm.amount),
        currency: payForm.currency,
        paymentMethod: payForm.paymentMethod,
        reference: payForm.reference || undefined,
        periodStart: payForm.periodStart,
        periodEnd: payForm.periodEnd,
        notes: payForm.notes || undefined,
      });
      setShowRecordPayment(false);
      setPayForm({ amount: "", currency: currency.code, paymentMethod: "MPESA", reference: "", periodStart: "", periodEnd: "", notes: "" });
      showToast("Payment recorded — pending confirmation");
    } catch (e: any) { showToast(e.message, false); }
    finally { setSaving(false); }
  };

  const handleSuspend = async () => {
    if (!confirm("Suspend this subscription?")) return;
    await suspend(actionNotes || undefined);
    showToast("Subscription suspended");
    setActionNotes("");
  };

  const handleReinstate = async () => {
    await reinstate();
    showToast("Subscription reinstated");
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this subscription? This cannot be undone.")) return;
    await cancel(actionNotes || undefined);
    showToast("Subscription cancelled");
    setActionNotes("");
  };

  const sub = subscription;
  const daysLeft = sub?.endDate
    ? Math.max(0, Math.floor((new Date(sub.endDate).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.ok ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Subscription Management</h1>
        <button onClick={() => { fetchCurrent(); fetchPayments(); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Current Plan Banner */}
      {sub && (
        <div className={`rounded-xl border-2 p-5 flex items-center justify-between flex-wrap gap-4 ${sub.status !== "ACTIVE" ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "border-primary/30 bg-primary/5"}`}>
          <div className="flex items-center gap-4">
            <div className={`text-3xl font-black ${sub.status !== "ACTIVE" ? "text-orange-600" : "text-primary"}`}>
              {sub.plan}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[sub.status]}`}>
                  {sub.status}
                </span>
                <span className="text-sm text-muted-foreground capitalize">{sub.billingCycle} billing · {sub.currency}</span>
              </div>
              {sub.endDate && (
                <p className={`text-sm mt-0.5 ${daysLeft !== null && daysLeft <= 7 ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                  {daysLeft === 0 ? "Expires today!" : daysLeft !== null ? `${daysLeft} days remaining (expires ${new Date(sub.endDate).toLocaleDateString()})` : ""}
                </p>
              )}
              {sub.plan === "STARTER" && <p className="text-sm text-muted-foreground mt-0.5">Free plan — upgrade to unlock more features</p>}
            </div>
          </div>
          {daysLeft !== null && daysLeft <= 14 && sub.status === "ACTIVE" && (
            <div className="flex items-center gap-2 bg-orange-100 text-orange-800 px-3 py-2 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4" />
              Renewal due soon — record a payment below
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {(["overview", "payments", "manage"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "overview" ? "Plans" : t === "payments" ? "Payment History" : "Manage"}
          </button>
        ))}
      </div>

      {/* ── Overview / Plan Selection ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {(["monthly", "annual"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setBilling(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border ${billing === c ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 hover:bg-muted"}`}
              >
                {c === "annual" ? "Annual (save 20%)" : "Monthly"}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {["STARTER", "BUSINESS", "ENTERPRISE"].map((plan) => {
              const Icon = PLAN_ICONS[plan];
              const price = planPrice(plan, billing, currency.code);
              const isCurrent = sub?.plan === plan;
              const isDowngrade = ["STARTER", "BUSINESS", "ENTERPRISE"].indexOf(plan) < ["STARTER", "BUSINESS", "ENTERPRISE"].indexOf(sub?.plan ?? "STARTER");
              return (
                <div key={plan} className={`rounded-xl border-2 p-5 flex flex-col gap-4 relative ${PLAN_COLORS[plan]} ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                  {plan === "BUSINESS" && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>}
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${plan === "BUSINESS" || plan === "ENTERPRISE" ? "text-primary" : "text-muted-foreground"}`} />
                    <h2 className="text-lg font-bold">{plan}</h2>
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold">{price === 0 ? "Free" : `${EA_CURRENCIES[currency.code]?.symbol ?? "KES"} ${price.toLocaleString()}`}</p>
                    {price > 0 && <p className="text-xs text-muted-foreground">per month{billing === "annual" ? " (billed annually)" : ""}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground italic">{PLAN_TAGLINE[plan]}</p>
                  <ul className="space-y-1.5 flex-1">
                    {PLAN_FEATURES[plan].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan === "ENTERPRISE" || plan === "BUSINESS" ? "text-primary" : "text-green-500"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="w-full py-2 rounded-lg bg-primary/10 text-primary text-sm text-center font-semibold">
                      ✓ Current Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => plan === "ENTERPRISE" ? alert("Contact Logan Tech for Enterprise") : handleChangePlan(plan)}
                      disabled={saving}
                      className={`w-full py-2 rounded-lg text-sm font-semibold border transition-colors ${plan === "BUSINESS" ? "bg-primary text-primary-foreground hover:bg-primary/90" : isDowngrade ? "border-orange-400 text-orange-700 hover:bg-orange-50" : "border-primary text-primary hover:bg-primary/5"}`}
                    >
                      {plan === "ENTERPRISE" ? "Contact Sales" : isDowngrade ? `Downgrade to ${plan}` : `Upgrade to ${plan}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Payment History ── */}
      {tab === "payments" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{payments.length} payment record{payments.length !== 1 ? "s" : ""}</p>
            <button
              onClick={() => setShowRecordPayment(true)}
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              + Record Payment
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Method</th>
                    <th className="text-left p-3 font-medium">Reference</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Period</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Confirmed By</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((p: SubscriptionPayment) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="p-3 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="p-3">{METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</td>
                      <td className="p-3 font-mono text-xs">{p.reference ?? "—"}</td>
                      <td className="p-3 text-right font-semibold">{fmtAmt(Number(p.amount), p.currency)}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(p.periodStart).toLocaleDateString()} — {new Date(p.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAY_STATUS_COLORS[p.status]}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs">{p.confirmer?.name ?? (p.status === "CONFIRMED" ? "Admin" : "—")}</td>
                      <td className="p-3">
                        {p.status === "PENDING" && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setConfirmingId(p.id)}
                              className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 font-medium"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleFail(p.id)}
                              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 font-medium"
                            >
                              Fail
                            </button>
                          </div>
                        )}
                        {p.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleRefund(p.id)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Confirm Payment Dialog */}
          {confirmingId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-background rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
                <h3 className="text-base font-bold">Confirm Payment</h3>
                <p className="text-sm text-muted-foreground">
                  This will mark the payment as confirmed and activate/extend the subscription.
                </p>
                <div>
                  <label className="text-sm font-medium block mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={confirmNotes}
                    onChange={(e) => setConfirmNotes(e.target.value)}
                    placeholder="e.g. M-Pesa code QC5ABC123"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmingId(null)} className="px-4 py-2 text-sm rounded-md border hover:bg-muted">Cancel</button>
                  <button onClick={() => handleConfirm(confirmingId)} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 font-medium">
                    {saving ? "Confirming…" : "Confirm Payment"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Record Payment Dialog */}
          {showRecordPayment && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-background rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
                <h3 className="text-base font-bold">Record Payment</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Amount *</label>
                    <input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                      placeholder="2500" className="w-full border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Currency</label>
                    <select value={payForm.currency} onChange={(e) => setPayForm({ ...payForm, currency: e.target.value })}
                      className="w-full border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                      {Object.keys(EA_CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Payment Method *</label>
                  <select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    className="w-full border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Reference / Transaction Code</label>
                  <input type="text" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                    placeholder="e.g. QC5ABC123" className="w-full border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Period Start *</label>
                    <input type="date" value={payForm.periodStart} onChange={(e) => setPayForm({ ...payForm, periodStart: e.target.value })}
                      className="w-full border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Period End *</label>
                    <input type="date" value={payForm.periodEnd} min={payForm.periodStart} onChange={(e) => setPayForm({ ...payForm, periodEnd: e.target.value })}
                      className="w-full border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Notes</label>
                  <input type="text" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                    className="w-full border rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowRecordPayment(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-muted">Cancel</button>
                  <button onClick={handleRecordPayment} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
                    {saving ? "Saving…" : "Record"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Manage Tab ── */}
      {tab === "manage" && sub && (
        <div className="space-y-6 max-w-lg">
          <div className="rounded-xl border p-5 space-y-3">
            <h2 className="text-base font-semibold">Subscription Details</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["Plan", sub.plan],
                ["Status", sub.status],
                ["Billing", sub.billingCycle],
                ["Currency", sub.currency],
                ["Amount", fmtAmt(Number(sub.amount), sub.currency) + "/mo"],
                ["Start Date", new Date(sub.startDate).toLocaleDateString()],
                ["End Date", sub.endDate ? new Date(sub.endDate).toLocaleDateString() : "N/A"],
                ["Days Left", daysLeft !== null ? `${daysLeft} days` : "N/A"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
            {sub.notes && <p className="text-xs text-muted-foreground border-t pt-2">Notes: {sub.notes}</p>}
          </div>

          <div className="rounded-xl border p-5 space-y-3">
            <h2 className="text-base font-semibold">Actions</h2>
            <div>
              <label className="text-xs font-medium block mb-1">Notes for action (optional)</label>
              <input type="text" value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Reason for change…"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {sub.status === "ACTIVE" && (
                <button onClick={handleSuspend} className="px-4 py-2 text-sm rounded-md border border-orange-400 text-orange-700 hover:bg-orange-50 font-medium">
                  Suspend
                </button>
              )}
              {(sub.status === "SUSPENDED" || sub.status === "INACTIVE") && (
                <button onClick={handleReinstate} className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 font-medium">
                  Reinstate
                </button>
              )}
              {sub.status !== "CANCELLED" && (
                <button onClick={handleCancel} className="px-4 py-2 text-sm rounded-md border border-red-400 text-red-700 hover:bg-red-50 font-medium">
                  Cancel Subscription
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Suspending disables premium features until reinstated. Cancellation is permanent.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
