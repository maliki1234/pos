"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useStoreStore } from "@/stores/useStoreStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, Plus, ReceiptText, Search, Trash2, WalletCards } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

type ExpenseFrequency = "ONE_TIME" | "DAILY" | "WEEKLY" | "MONTHLY";

interface Expense {
  id: string;
  category: string;
  description?: string | null;
  amount: string | number;
  frequency: ExpenseFrequency;
  expenseDate: string;
  store?: { id: string; name: string } | null;
}

const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  ONE_TIME: "One time",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

const EMPTY_FORM = {
  category: "",
  description: "",
  amount: "",
  frequency: "ONE_TIME" as ExpenseFrequency,
  expenseDate: new Date().toISOString().slice(0, 10),
  storeId: "",
};

function startOfMonth() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const { token, user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const { currency } = useCurrencyStore();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState(startOfMonth());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [storeFilter, setStoreFilter] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fmt = useCallback((amount: number) => (
    `${currency.symbol} ${amount.toLocaleString(currency.locale, {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    })}`
  ), [currency]);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const loadExpenses = useCallback(async () => {
    if (!token || !canManage) return;
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        take: "500",
      });
      if (storeFilter) params.set("storeId", storeFilter);
      if (query.trim()) params.set("category", query.trim());

      const res = await fetch(`${API}/expenses?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load running costs");
      setExpenses(data.data ?? []);
      setTotalAmount(Number(data.summary?.totalAmount ?? 0));
    } catch (err: any) {
      setError(err.message || "Failed to load running costs");
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders, canManage, endDate, query, startDate, storeFilter, token]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const averageExpense = useMemo(() => (
    expenses.length > 0 ? totalAmount / expenses.length : 0
  ), [expenses.length, totalAmount]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.category.trim() || !form.amount) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/expenses`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          category: form.category.trim(),
          description: form.description.trim() || undefined,
          amount: Number(form.amount),
          frequency: form.frequency,
          expenseDate: form.expenseDate,
          storeId: form.storeId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save running cost");
      setForm({ ...EMPTY_FORM, expenseDate: new Date().toISOString().slice(0, 10) });
      loadExpenses();
    } catch (err: any) {
      setError(err.message || "Failed to save running cost");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (expense: Expense) => {
    if (!confirm(`Delete ${expense.category} cost?`)) return;
    setError("");
    try {
      const res = await fetch(`${API}/expenses/${expense.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete running cost");
      loadExpenses();
    } catch (err: any) {
      setError(err.message || "Failed to delete running cost");
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Running Costs</h1>
        <p className="text-sm text-muted-foreground">Only admins and managers can manage running costs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Running Costs</h1>
          <p className="text-muted-foreground">Track rent, salaries, transport, utilities and daily business expenses.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <WalletCards className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalAmount)}</p>
            <p className="text-xs text-muted-foreground">Selected period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entries</CardTitle>
            <ReceiptText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{expenses.length.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Active records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Cost</CardTitle>
            <CalendarDays className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(averageExpense)}</p>
            <p className="text-xs text-muted-foreground">Per entry</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Add Running Cost
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Category *</label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Rent, salary, transport..."
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Amount *</label>
              <Input
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                type="number"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <Input
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                type="date"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as ExpenseFrequency }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Store</label>
              <select
                value={form.storeId}
                onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All business</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-5">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional note"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Cost"}
              </button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search category..."
                className="pl-9"
              />
            </div>
            <Input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" max={endDate} />
            <Input value={endDate} onChange={(e) => setEndDate(e.target.value)} type="date" min={startDate} />
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No running costs found for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <p className="font-medium">{expense.category}</p>
                        {expense.description && (
                          <p className="text-xs text-muted-foreground">{expense.description}</p>
                        )}
                      </TableCell>
                      <TableCell>{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                      <TableCell>{FREQUENCY_LABELS[expense.frequency] ?? expense.frequency}</TableCell>
                      <TableCell>{expense.store?.name ?? "All business"}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Number(expense.amount))}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => deleteExpense(expense)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
