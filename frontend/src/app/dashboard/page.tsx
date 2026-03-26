"use client";

import React, { useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAnalyticsStore } from "@/stores/useAnalyticsStore";
import { useStockStore } from "@/stores/useStockStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { dashboardStats, fetchDashboardStats } = useAnalyticsStore();
  const { lowStockCount, fetchLowStockProducts } = useStockStore();
  const { currency } = useCurrencyStore();
  const fmt = (n: number) => `${currency.symbol} ${n.toLocaleString("en-KE", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })}`;

  useEffect(() => {
    fetchDashboardStats();
    fetchLowStockProducts();
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, sub }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{sub ?? "Today"}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}!</h1>
        <p className="text-muted-foreground">
          {user?.role === "CASHIER"
            ? "Start processing transactions"
            : "Manage your point of sale system"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Revenue"
          value={dashboardStats ? fmt(dashboardStats.todayRevenue) : "—"}
          icon={DollarSign}
          color="text-blue-600"
          sub="Real-time"
        />
        <StatCard
          title="Transactions"
          value={dashboardStats ? (dashboardStats.transactionCount ?? 0).toLocaleString() : "—"}
          icon={ShoppingCart}
          color="text-indigo-600"
          sub="Today"
        />
        <StatCard
          title="Avg. Order"
          value={dashboardStats ? fmt(dashboardStats.avgOrder ?? 0) : "—"}
          icon={TrendingUp}
          color="text-green-600"
          sub="Today"
        />
        <StatCard
          title="Low Stock Items"
          value={dashboardStats ? (dashboardStats.lowStockCount ?? lowStockCount).toLocaleString() : lowStockCount.toLocaleString()}
          icon={AlertTriangle}
          color={lowStockCount > 0 ? "text-orange-600" : "text-muted-foreground"}
          sub={lowStockCount > 0 ? "Needs restocking" : "All stocked"}
        />
      </div>
    </div>
  );
}
