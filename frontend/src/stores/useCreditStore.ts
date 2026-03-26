import { create } from "zustand";
import { db, StoredCreditLedger } from "../lib/db";
import { useAuthStore } from "./useAuthStore";

const API = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface AgingBucket {
  count: number;
  totalOutstanding: number;
  entries: StoredCreditLedger[];
}

interface AgingReport {
  current: AgingBucket;
  thirtyToSixty: AgingBucket;
  overSixty: AgingBucket;
  noDueDate: AgingBucket;
}

interface CreditState {
  ledgerEntries: StoredCreditLedger[];
  agingReport: AgingReport | null;
  isLoading: boolean;
  error: string | null;

  fetchCustomerLedger: (customerId: string) => Promise<{ entries: StoredCreditLedger[]; totalOutstanding: number }>;
  fetchAgingReport: () => Promise<void>;
  recordRepayment: (
    ledgerId: string,
    amount: number,
    paymentMethod: string,
    notes?: string
  ) => Promise<void>;
  clearLedger: () => void;
}

export const useCreditStore = create<CreditState>((set) => ({
  ledgerEntries: [],
  agingReport: null,
  isLoading: false,
  error: null,

  fetchCustomerLedger: async (customerId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/credit/customer/${customerId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch credit ledger");
      const data = await res.json();
      const entries = data.data.entries || [];
      const totalOutstanding = data.data.totalOutstanding || 0;

      // Cache to IndexedDB
      const stored: StoredCreditLedger[] = entries.map((e: any) => ({
        id: e.id,
        customerId: e.customerId,
        transactionId: e.transactionId,
        originalAmount: parseFloat(e.originalAmount),
        amountPaid: parseFloat(e.amountPaid),
        outstandingBalance: parseFloat(e.outstandingBalance),
        dueDate: e.dueDate ? new Date(e.dueDate).getTime() : undefined,
        status: e.status,
        notes: e.notes,
        repayments: (e.repayments || []).map((r: any) => ({
          id: r.id,
          amount: parseFloat(r.amount),
          paymentMethod: r.paymentMethod,
          notes: r.notes,
          createdAt: new Date(r.createdAt).getTime(),
        })),
        lastSynced: Date.now(),
      }));

      await Promise.all(stored.map((s) => db.creditLedger.put(s)));
      set({ ledgerEntries: stored, isLoading: false });
      return { entries: stored, totalOutstanding };
    } catch (err: any) {
      // Fallback to IndexedDB
      const cached = await db.creditLedger.where("customerId").equals(customerId).toArray();
      const totalOutstanding = cached.reduce((s, e) => s + e.outstandingBalance, 0);
      set({ ledgerEntries: cached, error: "Using offline cache", isLoading: false });
      return { entries: cached, totalOutstanding };
    }
  },

  fetchAgingReport: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/credit/aging-report`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch aging report");
      const data = await res.json();
      set({ agingReport: data.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  recordRepayment: async (ledgerId, amount, paymentMethod, notes) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/credit/${ledgerId}/repay`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ amount, paymentMethod, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to record repayment");
      }
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  clearLedger: () => set({ ledgerEntries: [], agingReport: null, error: null }),
}));
