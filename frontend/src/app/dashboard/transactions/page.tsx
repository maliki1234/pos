"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import {
  CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, RotateCcw, Ban, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-toastify";

const API = process.env.NEXT_PUBLIC_API_URL;

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash", CARD: "Card", MOBILE_MONEY: "M-Pesa",
  CHEQUE: "Cheque", BANK_TRANSFER: "Bank Transfer", CREDIT: "Credit",
};

const TYPE_COLORS: Record<string, string> = {
  SALE:       "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  RETURN:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ADJUSTMENT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function TransactionsPage() {
  const { token, user } = useAuthStore();
  const { currency } = useCurrencyStore();
  const fmt = (n: number) => `${currency.symbol}${Number(n).toLocaleString("en-KE", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })}`;
  const canVoid = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Void dialog
  const [voidDialog, setVoidDialog] = useState<{ open: boolean; txn: any | null }>({ open: false, txn: null });
  const [voidReason, setVoidReason] = useState("");
  const [voidSaving, setVoidSaving] = useState(false);

  // Return dialog
  const [returnDialog, setReturnDialog] = useState<{ open: boolean; txn: any | null }>({ open: false, txn: null });
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnError, setReturnError] = useState("");

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/transactions?take=200`, { headers: authHeaders() });
      const data = await res.json();
      setTransactions(data.data ?? []);
    } catch { toast.error("Failed to load transactions"); }
    setIsLoading(false);
  }, [authHeaders]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const filtered = transactions.filter(t =>
    t.transactionNo?.toLowerCase().includes(query.toLowerCase()) ||
    t.customer?.name?.toLowerCase().includes(query.toLowerCase()) ||
    t.paymentMethod?.toLowerCase().includes(query.toLowerCase())
  );

  // ── Void ──
  const openVoid = (txn: any) => { setVoidDialog({ open: true, txn }); setVoidReason(""); };
  const handleVoid = async () => {
    if (!voidReason.trim()) return;
    setVoidSaving(true);
    try {
      const res = await fetch(`${API}/transactions/${voidDialog.txn.id}/void`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ reason: voidReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to void transaction");
      toast.success("Transaction voided");
      setVoidDialog({ open: false, txn: null });
      loadTransactions();
    } catch (err: any) { toast.error(err.message); }
    setVoidSaving(false);
  };

  // ── Return ──
  const openReturn = (txn: any) => {
    setReturnDialog({ open: true, txn });
    // Default return qty = 0 for each item
    const defaults: Record<number, number> = {};
    (txn.items ?? []).forEach((item: any) => { defaults[item.productId] = 0; });
    setReturnItems(defaults);
    setReturnReason("");
    setReturnError("");
  };

  const handleReturn = async () => {
    const itemsToReturn = Object.entries(returnItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId: parseInt(productId), quantity }));

    if (!itemsToReturn.length) { setReturnError("Select at least one item to return."); return; }
    if (!returnReason.trim()) { setReturnError("Return reason is required."); return; }

    setReturnSaving(true);
    setReturnError("");
    try {
      const res = await fetch(`${API}/transactions/${returnDialog.txn.id}/return`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ items: itemsToReturn, reason: returnReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to process return");
      toast.success(`Return ${data.data.transactionNo} processed — stock restored`);
      setReturnDialog({ open: false, txn: null });
      loadTransactions();
    } catch (err: any) { setReturnError(err.message); }
    setReturnSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">All sales, returns, and voids</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History ({filtered.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Search by transaction no. or customer…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No transactions found.</div>
          ) : (
            <div className="divide-y">
              {filtered.map(txn => {
                const isExpanded = expanded === txn.id;
                const isVoided = txn.isVoided;
                const isReturn = txn.transactionType === "RETURN";
                return (
                  <div key={txn.id}>
                    <div
                      className={`flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-muted/30 ${isVoided ? "opacity-60" : ""}`}
                      onClick={() => setExpanded(isExpanded ? null : txn.id)}
                    >
                      {/* Status icon */}
                      <div className="shrink-0">
                        {isVoided ? <XCircle className="h-5 w-5 text-red-500" /> :
                          isReturn ? <RotateCcw className="h-5 w-5 text-blue-500" /> :
                            <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{txn.transactionNo}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[txn.transactionType] ?? ""}`}>
                            {txn.transactionType}
                          </span>
                          {isVoided && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">VOIDED</span>}
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span>{new Date(txn.createdAt).toLocaleString()}</span>
                          {txn.customer?.name && <span>· {txn.customer.name}</span>}
                          <span>· {PAYMENT_LABELS[txn.paymentMethod] ?? txn.paymentMethod}</span>
                          {txn.store?.name && <span>· {txn.store.name}</span>}
                        </div>
                      </div>

                      {/* Amount + actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`font-bold text-base ${isReturn ? "text-blue-600" : "text-foreground"}`}>
                          {isReturn ? "−" : ""}{fmt(parseFloat(txn.totalAmount ?? 0))}
                        </span>
                        {canVoid && !isVoided && !isReturn && (
                          <button
                            onClick={e => { e.stopPropagation(); openVoid(txn); }}
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                            title="Void transaction"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        {!isVoided && !isReturn && (txn.items?.length > 0) && (
                          <button
                            onClick={e => { e.stopPropagation(); openReturn(txn); }}
                            className="p-1.5 rounded hover:bg-blue-50 text-muted-foreground hover:text-blue-600"
                            title="Return items"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded items */}
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-muted/20 border-t">
                        {txn.voidReason && (
                          <p className="text-xs text-red-600 py-2">Void reason: {txn.voidReason}</p>
                        )}
                        {txn.notes && (
                          <p className="text-xs text-muted-foreground py-2">{txn.notes}</p>
                        )}
                        <table className="w-full text-sm mt-2">
                          <thead>
                            <tr className="text-xs text-muted-foreground">
                              <th className="text-left pb-1 font-medium">Item</th>
                              <th className="text-right pb-1 font-medium">Qty</th>
                              <th className="text-right pb-1 font-medium">Unit Price</th>
                              <th className="text-right pb-1 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {(txn.items ?? []).map((item: any) => (
                              <tr key={item.id}>
                                <td className="py-1">{item.product?.name ?? `Product #${item.productId}`}</td>
                                <td className="py-1 text-right">{item.quantity}</td>
                                <td className="py-1 text-right">{fmt(parseFloat(item.unitPrice))}</td>
                                <td className="py-1 text-right font-medium">{fmt(parseFloat(item.lineTotal))}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t text-sm font-semibold">
                              <td colSpan={3} className="pt-2 text-muted-foreground">Total</td>
                              <td className="pt-2 text-right">{fmt(parseFloat(txn.totalAmount ?? 0))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Void Dialog ── */}
      {voidDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" /> Void Transaction
            </h3>
            <p className="text-sm text-muted-foreground">
              <strong>{voidDialog.txn?.transactionNo}</strong> — {fmt(parseFloat(voidDialog.txn?.totalAmount ?? 0))}<br />
              This will refund the full amount and restore all stock.
            </p>
            <div>
              <label className="text-sm font-medium block mb-1">Reason *</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
                placeholder="e.g. Customer changed mind, duplicate entry…"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setVoidDialog({ open: false, txn: null })} className="px-4 py-2 rounded-md border text-sm hover:bg-muted">Cancel</button>
              <button
                onClick={handleVoid}
                disabled={voidSaving || !voidReason.trim()}
                className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {voidSaving ? "Voiding…" : "Void Transaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return Dialog ── */}
      {returnDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-500" /> Return Items
            </h3>
            <p className="text-sm text-muted-foreground">
              From <strong>{returnDialog.txn?.transactionNo}</strong>. Enter the quantity to return for each item (leave 0 to skip).
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(returnDialog.txn?.items ?? []).map((item: any) => (
                <div key={item.productId} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{item.product?.name ?? `Product #${item.productId}`}</p>
                    <p className="text-xs text-muted-foreground">Sold: {item.quantity} × {fmt(parseFloat(item.unitPrice))}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs text-muted-foreground">Return qty:</label>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={returnItems[item.productId] ?? 0}
                      onChange={e => setReturnItems(prev => ({ ...prev, [item.productId]: parseInt(e.target.value) || 0 }))}
                      className="w-16 border rounded px-2 py-1 text-sm text-center bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setReturnItems(prev => ({ ...prev, [item.productId]: item.quantity }))}
                    >
                      All
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Reason *</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={2}
                placeholder="e.g. Damaged goods, wrong item, customer return…"
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
              />
            </div>

            {returnError && <p className="text-sm text-destructive">{returnError}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setReturnDialog({ open: false, txn: null })} className="px-4 py-2 rounded-md border text-sm hover:bg-muted">Cancel</button>
              <button
                onClick={handleReturn}
                disabled={returnSaving}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {returnSaving ? "Processing…" : "Process Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
