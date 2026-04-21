"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLoyaltyStore } from "@/stores/useLoyaltyStore";
import { useCreditStore } from "@/stores/useCreditStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";

const API = process.env.NEXT_PUBLIC_API_URL;

const tierColors: Record<string, string> = {
  BRONZE: "bg-amber-100 text-amber-800 border-amber-300",
  SILVER: "bg-gray-100 text-gray-700 border-gray-300",
  GOLD: "bg-yellow-100 text-yellow-800 border-yellow-300",
};

const txTypeColors: Record<string, string> = {
  EARN: "text-green-600",
  REDEEM: "text-red-600",
  ADJUSTMENT: "text-primary",
  EXPIRE: "text-gray-500",
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { token } = useAuthStore();
  const { currency } = useCurrencyStore();
  const fmt = (n: number) => `${currency.symbol} ${n.toLocaleString("en-KE", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })}`;
  const { account, fetchAccount, isLoading: loyaltyLoading } = useLoyaltyStore();
  const { ledgerEntries, fetchCustomerLedger } = useCreditStore();

  const [customer, setCustomer] = useState<any>(null);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    Promise.all([
      fetch(`${API}/customers/${id}`, { headers }).then((r) => r.json()),
      fetchAccount(id),
      fetchCustomerLedger(id).then((r) => setTotalOutstanding(r.totalOutstanding)),
    ])
      .then(([custData]) => {
        setCustomer(custData.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading customer…</div>;
  if (!customer) return <div className="p-6 text-destructive">Customer not found.</div>;

  const nextTierProgress = account?.nextTierPoints
    ? Math.min(100, Math.round((account.lifetimePoints / account.nextTierPoints) * 100))
    : 100;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <button
        onClick={() => router.back()}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        ← Back
      </button>

      {/* Customer Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground text-sm">{customer.email ?? "No email"} · {customer.phone ?? "No phone"}</p>
          <span className={`mt-2 inline-block rounded border px-2 py-0.5 text-xs font-medium ${customer.customerType === "WHOLESALE" ? "bg-secondary text-secondary-foreground border-border" : "bg-primary/10 text-primary border-primary/20"}`}>
            {customer.customerType}
          </span>
        </div>
        {account && (
          <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${tierColors[account.tier]}`}>
            {account.tier}
          </span>
        )}
      </div>

      {/* Loyalty Card */}
      <section className="rounded-lg border p-5 space-y-4">
        <h2 className="text-lg font-semibold">Loyalty Points</h2>
        {loyaltyLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : account ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{account.totalPoints.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Available Points</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{account.lifetimePoints.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Lifetime Points</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">
                  {fmt(account.totalPoints * (account.pointValueKES ?? 1))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Redemption Value</p>
              </div>
            </div>

            {account.nextTierPoints && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{account.tier}</span>
                  <span>{account.lifetimePoints} / {account.nextTierPoints} pts to next tier</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${nextTierProgress}%` }} />
                </div>
              </div>
            )}

            {account.pointsHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Recent Activity</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {account.pointsHistory.map((h) => (
                    <div key={h.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                      <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()} — {h.description ?? h.type}</span>
                      <span className={`font-semibold ${txTypeColors[h.type]}`}>
                        {h.points > 0 ? "+" : ""}{h.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No loyalty account yet. Points are earned on first purchase.</p>
        )}
      </section>

      {/* Credit Summary */}
      <section className="rounded-lg border p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Credit Balance</h2>
          <a href="/dashboard/credit" className="text-xs text-primary hover:underline">View full ledger →</a>
        </div>
        {totalOutstanding > 0 ? (
          <p className="text-2xl font-bold text-destructive">{fmt(totalOutstanding)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No outstanding credit.</p>
        )}
        {ledgerEntries.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">{ledgerEntries.filter(e => e.status !== "SETTLED").length} open {ledgerEntries.filter(e => e.status !== "SETTLED").length === 1 ? "entry" : "entries"}</p>
        )}
      </section>
    </div>
  );
}
