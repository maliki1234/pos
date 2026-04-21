"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Shield, LogOut, Search, Users, Building2, TrendingUp, RefreshCw, Sparkles, ChevronRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

function getToken() { return typeof window !== "undefined" ? localStorage.getItem("platformToken") : null; }
function getAdmin() {
  try { return JSON.parse(localStorage.getItem("platformAdmin") || "{}"); } catch { return {}; }
}

function authHeaders() {
  const t = getToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

const PLAN_COLORS: Record<string, string> = {
  STARTER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  BUSINESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ENTERPRISE: "bg-secondary text-secondary-foreground",
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-gray-100 text-gray-600",
  SUSPENDED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-red-100 text-red-700",
  EXPIRED: "bg-red-100 text-red-700",
};

export default function PlatformDashboard() {
  const router = useRouter();
  const admin = getAdmin();

  const [stats, setStats] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");

  // AI Customer Finder state
  const [selectedBiz, setSelectedBiz] = useState<any>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push("/platform/login"); return; }
    setLoading(true);
    try {
      const [statsRes, bizRes] = await Promise.all([
        fetch(`${API}/platform/stats`, { headers: authHeaders() }),
        fetch(`${API}/platform/businesses?limit=50`, { headers: authHeaders() }),
      ]);
      if (statsRes.status === 401 || bizRes.status === 401) {
        localStorage.removeItem("platformToken");
        router.push("/platform/login");
        return;
      }
      const statsData = await statsRes.json();
      const bizData = await bizRes.json();
      setStats(statsData.data);
      setBusinesses(bizData.data ?? []);
    } catch {}
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = () => {
    localStorage.removeItem("platformToken");
    localStorage.removeItem("platformAdmin");
    router.push("/platform/login");
  };

  const filteredBiz = businesses.filter(b =>
    b.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    b.email?.toLowerCase().includes(searchQ.toLowerCase())
  );

  const handleAiSearch = async () => {
    if (!selectedBiz || !aiQuery.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const res = await fetch(`${API}/platform/ai/find-customers`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ businessId: selectedBiz.id, query: aiQuery }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "AI search failed");
      setAiResult(data.data);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const EXAMPLE_QUERIES = [
    "Find customers who haven't bought anything in the last 30 days",
    "Show me customers with outstanding credit balances",
    "Who are the top 5 highest-spending customers?",
    "Find wholesale customers with overdue payments",
    "Which customers have gold loyalty status?",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b bg-card px-6 py-3 text-card-foreground shadow-sm">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Platform Admin</h1>
            <p className="text-xs text-muted-foreground">{admin.name} · {admin.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 rounded hover:bg-muted" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <ThemeToggle />
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-destructive hover:underline">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Building2 className="h-5 w-5" />} label="Total Businesses" value={stats.totalBusinesses} />
            <StatCard icon={<TrendingUp className="h-5 w-5 text-gray-500" />} label="Starter Plan" value={stats.planBreakdown?.STARTER ?? 0} />
            <StatCard icon={<TrendingUp className="h-5 w-5 text-blue-500" />} label="Business Plan" value={stats.planBreakdown?.BUSINESS ?? 0} />
            <StatCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label="Enterprise Plan" value={stats.planBreakdown?.ENTERPRISE ?? 0} />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Tenant List */}
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-4 border-b flex items-center justify-between gap-3">
              <h2 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> All Businesses</h2>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search..."
                  className="border rounded-md pl-7 pr-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-40"
                />
              </div>
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
              ) : filteredBiz.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No businesses found</div>
              ) : filteredBiz.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBiz(b); setAiResult(null); setAiQuery(""); setAiError(""); }}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 ${selectedBiz?.id === b.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                >
                  <div>
                    <p className="font-medium text-sm">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.country} · {b.currency}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PLAN_COLORS[b.subscription?.plan ?? "STARTER"]}`}>
                        {b.subscription?.plan ?? "STARTER"}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[b.subscription?.status ?? "ACTIVE"]}`}>
                        {b.subscription?.status ?? "ACTIVE"}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{b._count?.users ?? 0} users</span>
                      <span>{b._count?.customers ?? 0} customers</span>
                      <span>{b._count?.transactions ?? 0} txns</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* AI Customer Finder */}
          <div className="flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                AI Customer Finder
              </h2>
              {selectedBiz ? (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Searching in: <span className="font-medium text-foreground">{selectedBiz.name}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">Select a business from the list to begin</p>
              )}
            </div>

            <div className="p-4 space-y-3 flex-1">
              {!selectedBiz ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">Select a business on the left<br />to use AI-powered customer search</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={aiQuery}
                      onChange={e => setAiQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAiSearch()}
                      placeholder="Describe the customers you're looking for…"
                      className="flex-1 border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={aiLoading}
                    />
                    <button
                      onClick={handleAiSearch}
                      disabled={aiLoading || !aiQuery.trim()}
                      className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      {aiLoading ? "…" : "Search"}
                    </button>
                  </div>

                  {/* Example queries */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Examples:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLE_QUERIES.map(q => (
                        <button
                          key={q}
                          onClick={() => setAiQuery(q)}
                          className="text-xs border rounded-full px-2 py-0.5 hover:bg-muted transition-colors"
                        >
                          {q.length > 45 ? q.slice(0, 45) + "…" : q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {aiError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{aiError}</div>
                  )}

                  {aiResult && (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Found {aiResult.count} customer{aiResult.count !== 1 ? "s" : ""}
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{aiResult.explanation}</p>
                        {aiResult.insights && (
                          <p className="mt-2 border-t border-primary/20 pt-2 text-xs text-primary">
                            💡 {aiResult.insights}
                          </p>
                        )}
                      </div>

                      {aiResult.customers?.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr>
                                <th className="text-left p-2 font-medium">Name</th>
                                <th className="text-left p-2 font-medium">Phone</th>
                                <th className="text-right p-2 font-medium">Total Spent</th>
                                <th className="text-right p-2 font-medium">Credit Owed</th>
                                <th className="text-left p-2 font-medium">Loyalty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {aiResult.customers.map((c: any) => (
                                <tr key={c.id} className="hover:bg-muted/30">
                                  <td className="p-2 font-medium">{c.name}</td>
                                  <td className="p-2 text-muted-foreground">{c.phone ?? "—"}</td>
                                  <td className="p-2 text-right">{selectedBiz.currency} {Number(c.totalSpent).toLocaleString()}</td>
                                  <td className={`p-2 text-right ${c.outstandingCredit > 0 ? "text-red-600 font-semibold" : ""}`}>
                                    {c.outstandingCredit > 0 ? `${selectedBiz.currency} ${Number(c.outstandingCredit).toLocaleString()}` : "—"}
                                  </td>
                                  <td className="p-2">{c.loyaltyTier ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
