"use client";

import React, { useEffect, useState, useRef } from "react";
import { useCartStore } from "@/stores/useCartStore";
import { useStoreStore } from "@/stores/useStoreStore";
import { useProductsStore } from "@/stores/useProductsStore";
import { useSyncStore } from "@/stores/useSyncStore";
import { useLoyaltyStore } from "@/stores/useLoyaltyStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useLangStore } from "@/stores/useLangStore";
import {
  Plus, Minus, Trash2, Search, User, X, ChevronDown,
  CreditCard, Banknote, Smartphone, Building2, Clock, CheckCircle2,
  WifiOff, Loader2, SplitSquareHorizontal, Zap,
} from "lucide-react";
import { toast } from "react-toastify";
import { Receipt } from "@/components/Receipt";

const API = process.env.NEXT_PUBLIC_API_URL;

const PAYMENT_OPTIONS = [
  { value: "CASH",          label: "Cash",          icon: Banknote },
  { value: "MOBILE_MONEY",  label: "M-Pesa",        icon: Smartphone },
  { value: "AZAMPAY",       label: "Azampay",       icon: Zap },
  { value: "CARD",          label: "Card",           icon: CreditCard },
  { value: "BANK_TRANSFER", label: "Bank",           icon: Building2 },
  { value: "CHEQUE",        label: "Cheque",         icon: Building2 },
  { value: "CREDIT",        label: "Credit",         icon: Clock },
];

export default function CashierPage() {
  const {
    items, addItem, removeItem, updateItem, totalAmount, subtotal, taxAmount, discountAmount,
    submitTransaction, pricingType, setPricingType,
    paymentMethod, setPaymentMethod, dueDate, setDueDate,
    setCustomer, setStore, loyaltyPointsToRedeem, setLoyaltyRedemption,
  } = useCartStore();
  const { products, isLoading, searchProducts } = useProductsStore();
  const { isOnline } = useSyncStore();
  const { token } = useAuthStore();
  const { stores } = useStoreStore();
  const hasMultipleStores = stores.length > 1;
  const { currency } = useCurrencyStore();
  const { settings, fetchSettings } = useSettingsStore();
  const { t } = useLangStore();
  const fmt = (n: number) =>
    `${currency.symbol}${Number(n).toLocaleString("en-KE", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals })}`;

  const { account, fetchAccount, clearAccount } = useLoyaltyStore();
  const [query, setQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [pointsInput, setPointsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransactionId, setLastTransactionId] = useState("");
  const [cardReference, setCardReference] = useState("");
  const [creditSummary, setCreditSummary] = useState<{ totalOutstanding: number; openEntries: number; overdueCount: number } | null>(null);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);

  // Cash change calculator
  const [cashReceived, setCashReceived] = useState("");
  const change = cashReceived ? Math.max(0, parseFloat(cashReceived) - Number(totalAmount)) : null;

  // M-Pesa STK push
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaStatus, setMpesaStatus] = useState<"idle" | "pushing" | "pending" | "confirmed" | "failed">("idle");
  const [mpesaRef, setMpesaRef] = useState("");         // confirmed receipt number or manual ref
  const [mpesaManualRef, setMpesaManualRef] = useState(""); // for offline / fallback
  const [useManualRef, setUseManualRef] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState("");
  const [mpesaCountdown, setMpesaCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Azampay STK push
  const [azampayPhone, setAzampayPhone] = useState("");
  const [azampayStatus, setAzampayStatus] = useState<"idle" | "pushing" | "confirmed" | "failed">("idle");
  const [azampayExternalId, setAzampayExternalId] = useState("");

  const resetAzampay = () => { setAzampayStatus("idle"); setAzampayExternalId(""); };

  const handleAzampayPush = async () => {
    if (!azampayPhone.trim()) { toast.error("Enter customer phone number"); return; }
    setAzampayStatus("pushing");
    try {
      const res = await fetch(`${API}/payments/azampay/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone: azampayPhone,
          amount: Math.ceil(Number(totalAmount)),
          externalId: `POS_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Azampay checkout failed");
      setAzampayExternalId(data.data.externalId);
      setAzampayStatus("confirmed");
      toast.success("Azampay payment initiated — customer will receive a prompt");
    } catch (err: any) {
      setAzampayStatus("failed");
      toast.error(err.message);
    }
  };

  // Multi-tender
  const [multiTender, setMultiTender] = useState(false);
  const [cashPortion, setCashPortion] = useState("");
  const [mpesaPortion, setMpesaPortion] = useState("");

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleCustomerSearch = async (value: string) => {
    setCustomerQuery(value);
    if (!value.trim()) { setCustomerResults([]); return; }
    try {
      const res = await fetch(`${API}/customers?search=${encodeURIComponent(value)}&take=10`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setCustomerResults(data.data ?? []);
    } catch { setCustomerResults([]); }
  };

  const fetchCreditSummary = async (customerId: string) => {
    try {
      const res = await fetch(`${API}/credit/customer/${customerId}/summary`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCreditSummary((await res.json()).data);
    } catch { }
  };

  const handleSelectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustomer(c.id);
    setCustomerQuery(c.name);
    setCustomerResults([]);
    fetchAccount(c.id);
    fetchCreditSummary(c.id);
    // Pre-fill phone for payment methods
    if (c.phone && !mpesaPhone) setMpesaPhone(c.phone);
    if (c.phone && !azampayPhone) setAzampayPhone(c.phone);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomer("");
    setCustomerQuery("");
    setCustomerResults([]);
    clearAccount();
    setCreditSummary(null);
    setLoyaltyRedemption(0, 0);
    setPointsInput("");
  };

  const handleApplyPoints = () => {
    const pts = parseInt(pointsInput);
    if (!pts || pts <= 0 || !account) return;
    const maxPts = Math.min(pts, account.totalPoints);
    setLoyaltyRedemption(maxPts, maxPts * (account.pointValueKES ?? 1));
  };

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.trim()) {
      await searchProducts(value);
    } else {
      useProductsStore.getState().clearProducts();
    }
  };

  const handleAddItem = (product: any) => {
    const price = pricingType === "WHOLESALE"
      ? product.wholesale?.unitPrice || product.retail?.unitPrice || 0
      : product.retail?.unitPrice || 0;
    addItem({ productId: product.id, productName: product.name, quantity: 1, price });
  };

  const handleUpdateQuantity = (productId: number, qty: number) => {
    if (qty <= 0) removeItem(productId);
    else updateItem(productId, qty);
  };

  // ── M-Pesa STK Push ──────────────────────────────────────────────────────────
  const startCountdown = (seconds: number) => {
    setMpesaCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setMpesaCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStkPush = async () => {
    if (!mpesaPhone.trim()) { toast.error("Enter customer phone number"); return; }
    setMpesaStatus("pushing");
    try {
      const res = await fetch(`${API}/payments/mpesa/stk-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: mpesaPhone, amount: Math.ceil(Number(totalAmount)), reference: "POS" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "STK push failed");
      setMpesaCheckoutId(data.data.checkoutRequestId);
      setMpesaStatus("pending");
      startCountdown(60);
      // Poll for status
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const sr = await fetch(`${API}/payments/mpesa/status/${data.data.checkoutRequestId}`, { headers: { Authorization: `Bearer ${token}` } });
          const sd = await sr.json();
          if (sd.data?.paid) {
            clearInterval(pollRef.current!);
            setMpesaStatus("confirmed");
            setMpesaRef(data.data.checkoutRequestId);
            toast.success("M-Pesa payment confirmed!");
          } else if (sd.data?.cancelled || attempts >= 18) {
            clearInterval(pollRef.current!);
            setMpesaStatus("failed");
          }
        } catch { /* keep polling */ }
      }, 5000);
    } catch (err: any) {
      setMpesaStatus("failed");
      toast.error(err.message);
    }
  };

  const resetMpesa = () => {
    setMpesaStatus("idle");
    setMpesaRef("");
    setMpesaCheckoutId("");
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  // ── Multi-tender sync ───────────────────────────────────────────────────────
  useEffect(() => {
    if (multiTender && cashPortion) {
      const cash = parseFloat(cashPortion) || 0;
      const mpesa = Math.max(0, Number(totalAmount) - cash);
      setMpesaPortion(mpesa.toFixed(2));
    }
  }, [cashPortion, totalAmount, multiTender]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (items.length === 0) { toast.error(t("cart_empty")); return; }
    if (paymentMethod === "CREDIT" && !selectedCustomer) { toast.error(t("credit_needs_customer")); return; }
    if (paymentMethod === "MOBILE_MONEY" && settings?.mpesaEnabled && !isOnline && !mpesaManualRef.trim() && !useManualRef) {
      toast.error("Enter M-Pesa confirmation code (offline mode)");
      setUseManualRef(true);
      return;
    }

    let finalMpesaRef = mpesaRef;
    if (useManualRef && mpesaManualRef.trim()) finalMpesaRef = mpesaManualRef.trim();

    if (paymentMethod === "CARD" && cardReference.trim()) {
      useCartStore.getState().setNotes(`Card Ref: ${cardReference.trim()}`);
    }
    if (paymentMethod === "AZAMPAY" && azampayExternalId) {
      useCartStore.getState().setNotes(`Azampay Ref: ${azampayExternalId}`);
    }

    // Build payments array for multi-tender
    let paymentsArr: { method: string; amount: number }[] | undefined;
    if (multiTender && cashPortion && mpesaPortion) {
      paymentsArr = [
        { method: "CASH", amount: parseFloat(cashPortion) || 0 },
        { method: "MOBILE_MONEY", amount: parseFloat(mpesaPortion) || 0 },
      ];
    }

    setIsSubmitting(true);
    try {
      const { setMpesaRef: setCartMpesaRef, setPayments } = useCartStore.getState();
      setCartMpesaRef(finalMpesaRef || undefined);
      setPayments(paymentsArr);

      const transaction = await submitTransaction();
      setLastTransactionId(transaction.id);
      setShowReceipt(true);
      setShowPaymentPanel(false);
      resetMpesa();
      resetAzampay();
      setMultiTender(false);
      setCashPortion(""); setMpesaPortion("");
      toast.success(isOnline ? t("sale_complete") : t("saved_offline"));
    } catch (err: any) {
      toast.error(err.message || "Failed to process transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const mpesaEnabled = settings?.mpesaEnabled ?? false;
  const azampayEnabled = settings?.azampayEnabled ?? false;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 -m-8 overflow-hidden rounded-xl border shadow-sm">

      {/* ══ LEFT: Products ══ */}
      <div className="flex flex-col flex-1 min-w-0 bg-background">
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-card shrink-0">
          {hasMultipleStores && (
            <select onChange={e => setStore(e.target.value)} defaultValue=""
              className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All Stores</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="flex items-center rounded-lg border p-0.5 bg-muted text-sm font-medium shrink-0">
            <button onClick={() => setPricingType("RETAIL")}
              className={`px-3 py-1.5 rounded-md transition-colors ${pricingType === "RETAIL" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t("retail")}
            </button>
            <button onClick={() => setPricingType("WHOLESALE")}
              className={`px-3 py-1.5 rounded-md transition-colors ${pricingType === "WHOLESALE" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t("wholesale")}
            </button>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input autoFocus type="text" placeholder={t("search_product")}
              value={query} onChange={e => handleSearch(e.target.value)}
              className="w-full h-10 border rounded-lg pl-9 pr-4 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            {query && (
              <button onClick={() => handleSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {!isOnline && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1.5 rounded-lg shrink-0">
              <WifiOff className="h-3.5 w-3.5" /> {t("offline")}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-8 w-8 mb-3 animate-spin opacity-50" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground select-none">
              <Search className="h-16 w-16 mb-4 opacity-10" />
              <p className="text-base font-medium">{query ? t("no_products") : t("search_hint")}</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 font-medium">{t("product")}</th>
                    <th className="text-right px-4 py-2.5 font-medium">{t("price")}</th>
                    <th className="text-right px-4 py-2.5 font-medium">{t("stock")}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((product: any) => {
                    const price = pricingType === "WHOLESALE"
                      ? product.wholesale?.unitPrice || product.retail?.unitPrice || 0
                      : product.retail?.unitPrice || 0;
                    const stock = product.stock?.quantity ?? 0;
                    const inCart = items.find(i => i.productId === product.id);
                    return (
                      <tr key={product.id}
                        onClick={() => stock > 0 && handleAddItem(product)}
                        className={`transition-colors ${stock === 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent/50"} ${inCart ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3">
                          <span className="font-medium">{product.name}</span>
                          {inCart && <span className="ml-2 text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">×{inCart.quantity} in cart</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary tabular-nums">{fmt(price)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums text-xs font-medium ${stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {stock === 0 ? t("out_of_stock") : stock}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {stock > 0 && (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                              <Plus className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT: Cart + Checkout ══ */}
      <div className="w-[380px] shrink-0 flex flex-col border-l bg-card">
        {/* Cart header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base">{t("order")}</span>
            {totalQty > 0 && <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{totalQty}</span>}
          </div>
          {items.length > 0 && (
            <button onClick={() => { items.forEach(i => removeItem(i.productId)); }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors">
              {t("clear_all")}
            </button>
          )}
        </div>

        {/* Customer */}
        <div className="px-4 py-3 border-b shrink-0">
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input placeholder={t("add_customer")} value={customerQuery}
                  onChange={e => handleCustomerSearch(e.target.value)}
                  className="w-full h-8 border rounded-lg pl-8 pr-3 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              {selectedCustomer && (
                <button onClick={handleClearCustomer} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {customerResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 rounded-lg border bg-background shadow-xl max-h-36 overflow-y-auto">
                {customerResults.map(c => (
                  <button key={c.id} onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedCustomer && account && (
            <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">{account.tier} member</span>
                <span className="font-bold">{account.totalPoints.toLocaleString()} pts</span>
              </div>
              {account.totalPoints > 0 && (
                <div className="flex gap-1.5">
                  <input type="number" min={1} max={account.totalPoints} placeholder="Points to redeem" value={pointsInput}
                    onChange={e => setPointsInput(e.target.value)}
                    className="flex-1 h-6 border rounded px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={handleApplyPoints}
                    className="px-2 h-6 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shrink-0">
                    Redeem
                  </button>
                </div>
              )}
              {loyaltyPointsToRedeem > 0 && <p className="text-green-600 font-medium">−{loyaltyPointsToRedeem} pts = −{fmt(loyaltyPointsToRedeem)}</p>}
            </div>
          )}
          {/* Credit limit warning */}
          {selectedCustomer && selectedCustomer.creditLimit != null && paymentMethod === "CREDIT" && (
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs border ${
              creditSummary && creditSummary.totalOutstanding >= selectedCustomer.creditLimit
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              {t("credit_limit")}: {fmt(selectedCustomer.creditLimit)}
              {creditSummary && creditSummary.totalOutstanding > 0 && (
                <span className="ml-1">({t("used")}: {fmt(creditSummary.totalOutstanding)})</span>
              )}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground select-none py-12">
              <p className="text-sm">{t("no_items")}</p>
              <p className="text-xs mt-0.5 opacity-70">{t("click_to_add")}</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.productId} className="flex items-center gap-2 rounded-lg bg-muted/40 border px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{fmt(Number(item.price))} each</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                    className="h-6 w-6 rounded-md border bg-background flex items-center justify-center hover:bg-muted transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-7 text-center text-xs font-bold">{item.quantity}</span>
                  <button onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                    className="h-6 w-6 rounded-md border bg-background flex items-center justify-center hover:bg-muted transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                  <button onClick={() => removeItem(item.productId)}
                    className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-0.5">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-xs font-bold text-right w-16 shrink-0">{fmt(Number(item.price) * item.quantity)}</div>
              </div>
            ))
          )}
        </div>

        {/* Totals + Checkout */}
        <div className="border-t shrink-0 bg-card">
          <div className="px-5 py-3 space-y-1.5 text-sm border-b">
            <div className="flex justify-between text-muted-foreground">
              <span>{t("subtotal")}</span><span>{fmt(Number(subtotal))}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600"><span>{t("discount")}</span><span>−{fmt(Number(discountAmount))}</span></div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>{t("tax")} (10%)</span><span>{fmt(Number(taxAmount))}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1 border-t">
              <span>{t("total")}</span><span className="text-primary text-lg">{fmt(Number(totalAmount))}</span>
            </div>
          </div>

          {/* Payment panel */}
          <div className="px-5 py-3 border-b">
            <button onClick={() => setShowPaymentPanel(p => !p)} className="flex items-center justify-between w-full text-sm">
              <span className="font-medium text-muted-foreground">{t("payment")}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{PAYMENT_OPTIONS.find(p => p.value === paymentMethod)?.label}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPaymentPanel ? "rotate-180" : ""}`} />
              </div>
            </button>

            {showPaymentPanel && (
              <div className="mt-3 space-y-3">
                {/* Payment grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.value}
                        onClick={() => { setPaymentMethod(opt.value as any); resetMpesa(); resetAzampay(); setMultiTender(false); }}
                        className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 px-1 text-[11px] font-medium transition-all
                          ${paymentMethod === opt.value ? "border-primary bg-primary text-primary-foreground shadow" : "border-border hover:border-primary/50 hover:bg-accent"}`}>
                        <Icon className="h-4 w-4" />{opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Cash: change calculator */}
                {paymentMethod === "CASH" && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">{t("cash_received")}</label>
                      <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                        placeholder={fmt(Number(totalAmount))}
                        className="w-full h-8 border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    {change !== null && change >= 0 && (
                      <div className={`rounded-lg px-3 py-2 text-sm font-semibold flex justify-between ${change > 0 ? "bg-green-50 border border-green-200 text-green-700" : "bg-muted"}`}>
                        <span>{t("change")}</span><span>{fmt(change)}</span>
                      </div>
                    )}
                    {/* Multi-tender toggle */}
                    <button onClick={() => { setMultiTender(m => !m); setCashPortion(""); setMpesaPortion(""); }}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                      <SplitSquareHorizontal className="h-3.5 w-3.5" />
                      {multiTender ? "Cancel split payment" : t("split_payment")}
                    </button>
                    {multiTender && (
                      <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                        <p className="text-xs font-medium text-muted-foreground">{t("split_cash_mpesa")} (Total: {fmt(Number(totalAmount))})</p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground">Cash</label>
                            <input type="number" value={cashPortion} onChange={e => setCashPortion(e.target.value)}
                              placeholder="0.00"
                              className="w-full h-7 border rounded px-2 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground">M-Pesa</label>
                            <input type="number" value={mpesaPortion} readOnly placeholder="0.00"
                              className="w-full h-7 border rounded px-2 text-xs bg-muted" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* M-Pesa */}
                {paymentMethod === "MOBILE_MONEY" && (
                  <div className="space-y-2">
                    {mpesaEnabled && isOnline ? (
                      <>
                        {mpesaStatus === "idle" && (
                          <>
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">{t("mpesa_phone")}</label>
                              <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}
                                placeholder="07XXXXXXXX or 2547XXXXXXXX"
                                className="w-full h-8 border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <button onClick={handleStkPush}
                              className="w-full h-9 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2">
                              <Smartphone className="h-4 w-4" /> {t("send_stk_push")}
                            </button>
                            <button onClick={() => setUseManualRef(u => !u)} className="text-xs text-muted-foreground hover:underline">
                              {useManualRef ? "Cancel manual entry" : t("enter_ref_manually")}
                            </button>
                            {useManualRef && (
                              <input value={mpesaManualRef} onChange={e => setMpesaManualRef(e.target.value)}
                                placeholder="M-Pesa confirmation code e.g. QHG2X..."
                                className="w-full h-8 border rounded-lg px-3 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                            )}
                          </>
                        )}
                        {mpesaStatus === "pushing" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> {t("sending_push")}
                          </div>
                        )}
                        {mpesaStatus === "pending" && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-amber-700 font-medium">
                              <Loader2 className="h-4 w-4 animate-spin" /> {t("waiting_mpesa")}
                            </div>
                            <p className="text-xs text-amber-600">{t("prompt_sent")} {mpesaPhone}</p>
                            {mpesaCountdown > 0 && <p className="text-xs text-amber-500">{t("expires_in")} {mpesaCountdown}s</p>}
                            <button onClick={resetMpesa} className="text-xs text-amber-700 hover:underline">{t("cancel_retry")}</button>
                          </div>
                        )}
                        {mpesaStatus === "confirmed" && (
                          <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2 text-sm text-green-700 font-medium">
                            <CheckCircle2 className="h-5 w-5" /> {t("mpesa_confirmed")} ({mpesaRef})
                          </div>
                        )}
                        {mpesaStatus === "failed" && (
                          <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                            <p className="text-sm text-red-700">{t("mpesa_failed")}</p>
                            <div className="flex gap-2">
                              <button onClick={resetMpesa} className="text-xs text-red-600 hover:underline">{t("try_again")}</button>
                              <button onClick={() => { setUseManualRef(true); setMpesaStatus("idle"); }} className="text-xs text-muted-foreground hover:underline">{t("enter_ref_manually")}</button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // Offline or M-Pesa not configured — manual ref
                      <div className="space-y-2">
                        {!isOnline && <p className="text-xs text-orange-600 font-medium">⚠ {t("offline_mpesa_note")}</p>}
                        {!mpesaEnabled && <p className="text-xs text-muted-foreground">{t("mpesa_not_configured")}</p>}
                        <label className="text-xs text-muted-foreground block">{t("mpesa_ref_label")}</label>
                        <input value={mpesaManualRef} onChange={e => setMpesaManualRef(e.target.value)}
                          placeholder="M-Pesa confirmation code e.g. QHG2X..."
                          className="w-full h-8 border rounded-lg px-3 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    )}
                  </div>
                )}

                {/* Azampay */}
                {paymentMethod === "AZAMPAY" && (
                  <div className="space-y-2">
                    {!azampayEnabled ? (
                      <p className="text-xs text-muted-foreground">Azampay not configured. Enable it in Settings.</p>
                    ) : azampayStatus === "idle" ? (
                      <>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Customer Phone (TZ)</label>
                          <input type="tel" value={azampayPhone} onChange={e => setAzampayPhone(e.target.value)}
                            placeholder="0712345678 or 255712345678"
                            className="w-full h-8 border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <button onClick={handleAzampayPush}
                          className="w-full h-9 rounded-lg bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600 flex items-center justify-center gap-2">
                          <Zap className="h-4 w-4" /> Send Azampay Prompt
                        </button>
                      </>
                    ) : azampayStatus === "pushing" ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending payment request…
                      </div>
                    ) : azampayStatus === "confirmed" ? (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                          <CheckCircle2 className="h-5 w-5" /> Prompt sent — awaiting customer payment
                        </div>
                        <p className="text-xs text-green-600">Ref: {azampayExternalId}</p>
                        <button onClick={resetAzampay} className="text-xs text-muted-foreground hover:underline">Re-send</button>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
                        <p className="text-sm text-red-700">Azampay request failed</p>
                        <button onClick={resetAzampay} className="text-xs text-red-600 hover:underline">Try again</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Card reference */}
                {paymentMethod === "CARD" && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">{t("card_ref")}</label>
                    <input type="text" value={cardReference} onChange={e => setCardReference(e.target.value)}
                      placeholder="e.g. AUTH-7842"
                      className="w-full h-8 border rounded-lg px-3 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                )}

                {/* Credit fields */}
                {paymentMethod === "CREDIT" && (
                  <div className="space-y-2">
                    {!selectedCustomer && <p className="text-xs text-destructive font-medium">⚠ {t("select_customer_credit")}</p>}
                    {selectedCustomer && creditSummary && creditSummary.totalOutstanding > 0 && (
                      <div className={`rounded-lg px-3 py-2 text-xs border ${creditSummary.overdueCount > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                        <span className="font-semibold">{selectedCustomer.name}</span> {t("owes")} <span className="font-semibold">{fmt(creditSummary.totalOutstanding)}</span>
                        {creditSummary.overdueCount > 0 && ` — ${creditSummary.overdueCount} overdue`}
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">{t("due_date")} *</label>
                      <input type="date" value={dueDate ?? ""} onChange={e => setDueDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        className="w-full h-8 border rounded-lg px-3 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="px-5 py-4">
            <button onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0
              || (paymentMethod === "MOBILE_MONEY" && mpesaEnabled && isOnline && mpesaStatus !== "confirmed" && !mpesaManualRef && !useManualRef)
              || (paymentMethod === "AZAMPAY" && azampayEnabled && azampayStatus === "pushing")}
              className={`w-full h-14 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-2
                ${items.length === 0 ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-50"}`}>
              {isSubmitting
                ? <><Loader2 className="h-5 w-5 animate-spin" /> {t("processing")}</>
                : <><CheckCircle2 className="h-5 w-5" /> {t("charge")} {items.length > 0 ? fmt(Number(totalAmount)) : ""}</>}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Receipt
            items={items} subtotal={subtotal} discountAmount={discountAmount}
            taxAmount={taxAmount} totalAmount={totalAmount}
            paymentMethod={paymentMethod} pricingType={pricingType}
            transactionId={lastTransactionId}
            customerName={selectedCustomer?.name}
            customerPhone={selectedCustomer?.phone}
            onClose={() => setShowReceipt(false)}
          />
        </div>
      )}
    </div>
  );
}
