"use client";

import { useEffect, useState } from "react";
import { useAnalyticsStore } from "@/stores/useAnalyticsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

function useFmt() {
  const { currency } = useCurrencyStore();
  const fmt = (n: number) => `${currency.symbol} ${n.toLocaleString("en-KE", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })}`;
  const fmtShort = (n: number) => {
    if (n >= 1_000_000) return `${currency.symbol} ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${currency.symbol} ${(n / 1_000).toFixed(1)}K`;
    return `${currency.symbol} ${n.toFixed(0)}`;
  };
  return { fmt, fmtShort };
}

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { fmt, fmtShort } = useFmt();
  const { user } = useAuthStore();
  const {
    dashboardStats, salesTrend, topProducts, paymentBreakdown, profitData, staffPerformance,
    fetchDashboardStats, fetchSalesTrend, fetchTopProducts, fetchPaymentBreakdown,
    fetchProfitReport, fetchStaffPerformance,
    isLoading,
  } = useAnalyticsStore();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    fetchSalesTrend(startDate, endDate);
    fetchTopProducts(10, startDate, endDate);
    fetchPaymentBreakdown(startDate, endDate);
    fetchProfitReport(startDate, endDate);
    fetchStaffPerformance(startDate, endDate);
  }, [startDate, endDate]);

  const { subscription } = useSubscriptionStore();
  const plan = subscription?.plan ?? "STARTER";
  const hasBusiness = plan === "BUSINESS" || plan === "ENTERPRISE";

  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return <div className="p-6 text-destructive">Access denied. ADMIN or MANAGER role required.</div>;
  }

  if (!hasBusiness) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold mb-2">Analytics — BUSINESS Plan Feature</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Unlock sales trends, top products, payment breakdown, profit margin analysis, and staff performance reports. Upgrade to the BUSINESS plan to access analytics.
        </p>
        <Link href="/dashboard/subscription" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
          View Plans & Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">From</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <label className="text-muted-foreground">To</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboardStats && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Today at a Glance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Today's Revenue" value={fmt(dashboardStats.todayRevenue)} />
            <StatCard label="Transactions" value={(dashboardStats.transactionCount ?? 0).toLocaleString()} />
            <StatCard
              label="Avg Order Value"
              value={fmt(dashboardStats.avgOrder ?? 0)}
            />
            <StatCard
              label="Low Stock Items"
              value={dashboardStats.lowStockCount.toLocaleString()}
              sub={dashboardStats.lowStockCount > 0 ? "Needs attention" : "All good"}
            />
          </div>
        </section>
      )}

      {/* Sales Trend */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Sales Trend</h2>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>
        ) : salesTrend.length > 0 ? (
          <div className="rounded-lg border p-4">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={salesTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Line type="monotone" dataKey="totalRevenue" stroke="#6366f1" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="transactionCount" stroke="#10b981" strokeWidth={2} dot={false} name="Transactions" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sales data for this period.</p>
        )}
      </section>

      {/* Top Products */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Top Products by Revenue</h2>
        {topProducts.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-lg border p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="totalRevenue" fill="#6366f1" name="Revenue" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">#</th>
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-right p-3 font-medium">Units Sold</th>
                    <th className="text-right p-3 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topProducts.map((p: any, i: number) => (
                    <tr key={p.productId} className="hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground">{i + 1}</td>
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-right">{Number(p.totalQty).toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">{fmt(Number(p.totalRevenue))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No product data for this period.</p>
        )}
      </section>

      {/* Payment Breakdown */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Payment Method Breakdown</h2>
        {paymentBreakdown.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="rounded-lg border p-4 flex justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="totalAmount"
                    nameKey="paymentMethod"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ paymentMethod, percent }) =>
                      `${paymentMethod} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {paymentBreakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Method</th>
                    <th className="text-right p-3 font-medium">Transactions</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paymentBreakdown.map((row: any, i: number) => (
                    <tr key={row.paymentMethod} className="hover:bg-muted/30">
                      <td className="p-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {row.paymentMethod}
                      </td>
                      <td className="p-3 text-right">{Number(row.count).toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">{fmt(Number(row.totalAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No payment data for this period.</p>
        )}
      </section>

      {/* Profit Margin */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Profit Margin by Product</h2>
        {profitData.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Product</th>
                  <th className="text-right p-3 font-medium">Revenue</th>
                  <th className="text-right p-3 font-medium">COGS</th>
                  <th className="text-right p-3 font-medium">Gross Profit</th>
                  <th className="text-right p-3 font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {profitData.map((row: any) => (
                    <tr key={row.productId} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-right">{fmt(Number(row.revenue))}</td>
                      <td className="p-3 text-right text-muted-foreground">{fmt(Number(row.cost))}</td>
                      <td className="p-3 text-right font-semibold text-green-600">{fmt(Number(row.profit))}</td>
                      <td className="p-3 text-right">
                        <span className={`font-semibold ${row.marginPct >= 20 ? "text-green-600" : row.marginPct >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                          {Number(row.marginPct).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No profit data for this period.</p>
        )}
      </section>

      {/* Staff Performance */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Staff Performance</h2>
        {staffPerformance.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Staff Member</th>
                  <th className="text-right p-3 font-medium">Transactions</th>
                  <th className="text-right p-3 font-medium">Total Revenue</th>
                  <th className="text-right p-3 font-medium">Avg Order</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staffPerformance.map((s: any) => (
                  <tr key={s.userId} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{s.name ?? s.userId}</td>
                    <td className="p-3 text-right">{Number(s.transactionCount).toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold">{fmt(Number(s.totalRevenue))}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {s.transactionCount > 0 ? fmt(Number(s.avgTransaction)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No staff data for this period.</p>
        )}
      </section>
    </div>
  );
}
