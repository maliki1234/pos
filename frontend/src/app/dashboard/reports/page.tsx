"use client";

import React, { useEffect, useState } from "react";
import { useAnalyticsStore } from "@/stores/useAnalyticsStore";
import { useCreditStore } from "@/stores/useCreditStore";
import { useStockStore } from "@/stores/useStockStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, AlertTriangle, Lightbulb, Download,
  ShoppingCart, DollarSign, Clock, Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── helpers ────────────────────────────────────────────────────────────────

function useFormat() {
  const { currency } = useCurrencyStore();
  return (n: number) =>
    `${currency.symbol} ${n.toLocaleString("en-KE", {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    })}`;
}

function exportCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type RecommendationType = "warning" | "success" | "info" | "action";

interface Recommendation {
  type: RecommendationType;
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: string;
}

// ─── component ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const fmt = useFormat();
  const {
    dashboardStats, salesTrend, topProducts, paymentBreakdown, profitData, staffPerformance,
    fetchDashboardStats, fetchSalesTrend, fetchTopProducts, fetchPaymentBreakdown,
    fetchProfitReport, fetchStaffPerformance,
  } = useAnalyticsStore();
  const { agingReport, fetchAgingReport } = useCreditStore();
  const { lowStockProducts, fetchLowStockProducts } = useStockStore();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const sevenAgo  = new Date(Date.now() -  7 * 86400000).toISOString().slice(0, 10);

  const [period, setPeriod] = useState<"7d" | "30d" | "custom">("30d");
  const [start, setStart] = useState(thirtyAgo);
  const [end,   setEnd]   = useState(today);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    fetchLowStockProducts();
    fetchAgingReport();
  }, []);

  useEffect(() => {
    const s = period === "7d" ? sevenAgo : period === "30d" ? thirtyAgo : start;
    const e = period === "custom" ? end : today;
    setIsLoading(true);
    Promise.all([
      fetchSalesTrend(s, e),
      fetchTopProducts(10, s, e),
      fetchPaymentBreakdown(s, e),
      fetchProfitReport(s, e),
      fetchStaffPerformance(s, e),
    ]).finally(() => setIsLoading(false));
  }, [period, start, end]);

  // ── Recommendations engine ─────────────────────────────────────────────
  const recommendations: Recommendation[] = [];

  if (lowStockProducts.length > 0) {
    recommendations.push({
      type: "warning",
      icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
      title: `${lowStockProducts.length} product${lowStockProducts.length > 1 ? "s" : ""} running low`,
      body: `${lowStockProducts.slice(0, 3).map(p => p.name).join(", ")}${lowStockProducts.length > 3 ? ` and ${lowStockProducts.length - 3} more` : ""} are below reorder point.`,
      action: "Go to Stock →",
    });
  }

  if (agingReport?.overSixty && agingReport.overSixty.totalOutstanding > 0) {
    recommendations.push({
      type: "action",
      icon: <Clock className="h-5 w-5 text-red-500" />,
      title: "Overdue credit needs collection",
      body: `${agingReport.overSixty.count} entr${agingReport.overSixty.count === 1 ? "y" : "ies"} are 60+ days overdue (${fmt(agingReport.overSixty.totalOutstanding)}). Contact customers immediately.`,
      action: "View Credit Ledger →",
    });
  }

  if (profitData.length > 0) {
    const lowMargin = profitData.filter((p: any) => p.marginPct < 10 && p.revenue > 0);
    if (lowMargin.length > 0) {
      recommendations.push({
        type: "warning",
        icon: <TrendingUp className="h-5 w-5 text-yellow-500" />,
        title: `${lowMargin.length} product${lowMargin.length > 1 ? "s" : ""} with thin margins (<10%)`,
        body: `${lowMargin.slice(0, 2).map((p: any) => p.name).join(", ")} have very low profit margins. Consider raising prices or renegotiating supplier costs.`,
      });
    }
    const topMargin = [...profitData].sort((a: any, b: any) => b.marginPct - a.marginPct)[0] as any;
    if (topMargin && topMargin.marginPct > 30) {
      recommendations.push({
        type: "success",
        icon: <Star className="h-5 w-5 text-green-500" />,
        title: `${topMargin.name} has your highest margin at ${topMargin.marginPct}%`,
        body: "Promote this product more aggressively — upsell at checkout and feature it in your storefront.",
      });
    }
  }

  if (paymentBreakdown.length > 0) {
    const cash = paymentBreakdown.find((p: any) => p.paymentMethod === "CASH");
    const total = paymentBreakdown.reduce((s: number, p: any) => s + Number(p.totalAmount), 0);
    if (cash && total > 0 && (Number(cash.totalAmount) / total) > 0.8) {
      recommendations.push({
        type: "info",
        icon: <Lightbulb className="h-5 w-5 text-blue-500" />,
        title: "Over 80% of sales are cash — diversify payment options",
        body: "Enable M-Pesa, MTN MoMo, or card payments to reduce cash handling risk and attract more customers.",
      });
    }
  }

  if (staffPerformance.length > 1) {
    const sorted = [...staffPerformance].sort((a: any, b: any) => b.totalRevenue - a.totalRevenue) as any[];
    if (sorted[0].totalRevenue > sorted[sorted.length - 1].totalRevenue * 2) {
      recommendations.push({
        type: "info",
        icon: <Lightbulb className="h-5 w-5 text-indigo-500" />,
        title: `${sorted[0].name} is your top performer`,
        body: `${sorted[0].name} generated ${fmt(sorted[0].totalRevenue)} — consider having them mentor lower-performing staff.`,
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: "success",
      icon: <Star className="h-5 w-5 text-green-500" />,
      title: "Everything looks great!",
      body: "No critical issues detected. Keep monitoring daily to stay ahead.",
    });
  }

  const recColors: Record<RecommendationType, string> = {
    warning: "border-l-orange-400 bg-orange-50 dark:bg-orange-950/20",
    action:  "border-l-red-400 bg-red-50 dark:bg-red-950/20",
    info:    "border-l-blue-400 bg-blue-50 dark:bg-blue-950/20",
    success: "border-l-green-400 bg-green-50 dark:bg-green-950/20",
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Recommendations</h1>
          <p className="text-muted-foreground text-sm">Real-time insights powered by your sales data.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["7d", "30d", "custom"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${period === p ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              {p === "7d" ? "Last 7 Days" : p === "30d" ? "Last 30 Days" : "Custom"}
            </button>
          ))}
          {period === "custom" && (
            <>
              <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
              <input type="date" value={end} min={start} max={today} onChange={(e) => setEnd(e.target.value)}
                className="border rounded-md px-2 py-1 text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none" />
            </>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      {dashboardStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Revenue",    value: fmt(dashboardStats.todayRevenue),            icon: DollarSign,  color: "text-blue-600" },
            { label: "Transactions Today", value: (dashboardStats.transactionCount ?? 0).toLocaleString(), icon: ShoppingCart, color: "text-indigo-600" },
            { label: "Avg. Order Value",   value: fmt(dashboardStats.avgOrder ?? 0),            icon: TrendingUp,  color: "text-green-600" },
            { label: "Low Stock Items",    value: (dashboardStats.lowStockCount ?? 0).toLocaleString(), icon: AlertTriangle, color: dashboardStats.lowStockCount > 0 ? "text-orange-500" : "text-muted-foreground" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Smart Recommendations */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Smart Recommendations
        </h2>
        <div className="space-y-3">
          {recommendations.map((r, i) => (
            <div key={i} className={`border-l-4 rounded-r-lg p-4 flex items-start gap-3 ${recColors[r.type]}`}>
              <div className="mt-0.5 shrink-0">{r.icon}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{r.body}</p>
              </div>
              {r.action && (
                <span className="text-xs text-primary font-medium cursor-pointer hover:underline shrink-0">{r.action}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Sales Trend */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Sales Trend</h2>
          <button
            onClick={() => exportCSV("sales_trend.csv", salesTrend.map((s: any) => ({ date: s.date, revenue: s.totalRevenue, transactions: s.transactionCount })))}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
        </div>
        {salesTrend.length > 0 ? (
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="totalRevenue" stroke="#6366f1" strokeWidth={2} dot={false} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "No sales data for this period."}</p>
        )}
      </section>

      {/* Top Products & Profit Table */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Top Products</h2>
            <button
              onClick={() => exportCSV("top_products.csv", topProducts.map((p: any) => ({ product: p.name, units_sold: p.totalQty, revenue: p.totalRevenue })))}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
          {topProducts.length > 0 ? (
            <Card>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topProducts.slice(0, 6)} layout="vertical">
                    <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="totalRevenue" fill="#6366f1" name="Revenue" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {topProducts.slice(0, 5).map((p: any, i: number) => (
                    <div key={p.productId} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <span className="text-muted-foreground w-5">{i + 1}.</span>
                      <span className="flex-1 font-medium truncate">{p.name}</span>
                      <span className="text-muted-foreground text-xs mr-3">{Number(p.totalQty).toLocaleString()} units</span>
                      <span className="font-semibold">{fmt(Number(p.totalRevenue))}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "No data."}</p>}
        </section>

        {/* Profit Margin */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Profit Margin</h2>
            <button
              onClick={() => exportCSV("profit_margin.csv", profitData.map((p: any) => ({ product: p.name, revenue: p.revenue, cost: p.cost, profit: p.profit, margin_pct: p.marginPct })))}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
          {profitData.length > 0 ? (
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                        <th className="pb-2 font-medium text-right">Profit</th>
                        <th className="pb-2 font-medium text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {profitData.slice(0, 7).map((p: any) => (
                        <tr key={p.productId} className="hover:bg-muted/30">
                          <td className="py-2 font-medium truncate max-w-[120px]">{p.name}</td>
                          <td className="py-2 text-right text-xs">{fmt(Number(p.revenue))}</td>
                          <td className="py-2 text-right text-xs text-green-600">{fmt(Number(p.profit))}</td>
                          <td className="py-2 text-right">
                            <span className={`text-xs font-bold ${p.marginPct >= 20 ? "text-green-600" : p.marginPct >= 10 ? "text-yellow-600" : "text-red-500"}`}>
                              {Number(p.marginPct).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "No data."}</p>}
        </section>
      </div>

      {/* Payment Breakdown + Staff */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Payment Methods</h2>
            <button
              onClick={() => exportCSV("payment_breakdown.csv", paymentBreakdown.map((p: any) => ({ method: p.paymentMethod, count: p.count, total: p.totalAmount })))}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
          {paymentBreakdown.length > 0 ? (
            <Card>
              <CardContent className="pt-4 space-y-2">
                {paymentBreakdown.map((p: any) => {
                  const total = paymentBreakdown.reduce((s: number, r: any) => s + Number(r.totalAmount), 0);
                  const pct = total > 0 ? (Number(p.totalAmount) / total) * 100 : 0;
                  return (
                    <div key={p.paymentMethod}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{p.paymentMethod}</span>
                        <span className="text-muted-foreground">{fmt(Number(p.totalAmount))} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "No data."}</p>}
        </section>

        {/* Staff Performance */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Staff Performance</h2>
            <button
              onClick={() => exportCSV("staff_performance.csv", staffPerformance.map((s: any) => ({ name: s.name, role: s.role, transactions: s.transactionCount, revenue: s.totalRevenue, avg_order: s.avgTransaction })))}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
          {staffPerformance.length > 0 ? (
            <Card>
              <CardContent className="pt-4 space-y-2">
                {[...staffPerformance].sort((a: any, b: any) => b.totalRevenue - a.totalRevenue).map((s: any, i: number) => (
                  <div key={s.userId} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-100 text-yellow-800" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.transactionCount} txns · avg {fmt(s.avgTransaction)}</p>
                    </div>
                    <span className="text-sm font-semibold">{fmt(s.totalRevenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "No data."}</p>}
        </section>
      </div>

      {/* Credit Aging Summary */}
      {agingReport && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Credit Aging Summary</h2>
            <a href="/dashboard/credit" className="text-xs text-primary hover:underline">Manage →</a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "0–30 Days",     data: agingReport.current,       color: "border-yellow-200 bg-yellow-50" },
              { label: "31–60 Days",    data: agingReport.thirtyToSixty, color: "border-orange-200 bg-orange-50" },
              { label: "60+ Days",      data: agingReport.overSixty,     color: "border-red-200 bg-red-50"    },
              { label: "No Due Date",   data: agingReport.noDueDate,     color: "border-gray-200 bg-gray-50"  },
            ].map(({ label, data, color }) => (
              <Card key={label} className={`border ${color}`}>
                <CardContent className="pt-4">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold mt-1">{fmt(data.totalOutstanding)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{data.count} {data.count === 1 ? "entry" : "entries"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {agingReport.overSixty.totalOutstanding > 0 && (
            <div className="mt-3 rounded-lg border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700">
              <strong>Action required:</strong> {fmt(agingReport.overSixty.totalOutstanding)} is 60+ days overdue from {agingReport.overSixty.count} {agingReport.overSixty.count === 1 ? "customer" : "customers"}. Send payment reminders immediately.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
