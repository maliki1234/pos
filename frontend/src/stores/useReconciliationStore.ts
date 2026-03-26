import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const API = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface ReconciliationReport {
  reportDate: string;
  totalCash: number;
  totalMobileMoney: number;
  totalCard: number;
  totalCheque: number;
  totalBankTransfer: number;
  totalCredit: number;
  totalRevenue: number;
  expectedCash: number;
  transactionCount: number;
  voidCount: number;
  voidTotal: number;
  grossProfit: number;
  totalCOGS: number;
  paymentDetails: Array<{ paymentMethod: string; count: number; total: number }>;
  voidedTransactions: Array<{ transactionNo: string; totalAmount: number; voidReason: string | null }>;
  // Set by user input
  actualCash?: number;
  cashDiscrepancy?: number;
  discrepancyNotes?: string;
}

interface SavedReport extends ReconciliationReport {
  id: string;
  submittedBy: string;
  user?: { name: string };
  createdAt: string;
}

interface ReconciliationState {
  currentReport: ReconciliationReport | null;
  savedReports: SavedReport[];
  isGenerating: boolean;
  isSubmitting: boolean;
  isLoading: boolean;
  error: string | null;

  generateReport: (date: string, cashierId?: string) => Promise<void>;
  setActualCash: (amount: number) => void;
  setDiscrepancyNotes: (notes: string) => void;
  submitReport: () => Promise<void>;
  listReports: (startDate?: string, endDate?: string) => Promise<void>;
  clearReport: () => void;
}

export const useReconciliationStore = create<ReconciliationState>((set, get) => ({
  currentReport: null,
  savedReports: [],
  isGenerating: false,
  isSubmitting: false,
  isLoading: false,
  error: null,

  generateReport: async (date, cashierId) => {
    set({ isGenerating: true, error: null });
    try {
      const q = cashierId ? `?date=${date}&cashierId=${cashierId}` : `?date=${date}`;
      const res = await fetch(`${API}/reconciliation/generate${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to generate report");
      const data = await res.json();
      set({ currentReport: data.data, isGenerating: false });
    } catch (err: any) {
      set({ error: err.message, isGenerating: false });
    }
  },

  setActualCash: (amount) => {
    const report = get().currentReport;
    if (!report) return;
    set({
      currentReport: {
        ...report,
        actualCash: amount,
        cashDiscrepancy: amount - report.expectedCash,
      },
    });
  },

  setDiscrepancyNotes: (notes) => {
    const report = get().currentReport;
    if (!report) return;
    set({ currentReport: { ...report, discrepancyNotes: notes } });
  },

  submitReport: async () => {
    const report = get().currentReport;
    if (!report) return;
    set({ isSubmitting: true, error: null });
    try {
      const res = await fetch(`${API}/reconciliation/submit`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          date: report.reportDate,
          actualCash: report.actualCash ?? report.expectedCash,
          discrepancyNotes: report.discrepancyNotes ?? "",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to submit report");
      }
      set({ isSubmitting: false });
    } catch (err: any) {
      set({ error: err.message, isSubmitting: false });
      throw err;
    }
  },

  listReports: async (startDate, endDate) => {
    set({ isLoading: true });
    try {
      const params = [startDate && `startDate=${startDate}`, endDate && `endDate=${endDate}`]
        .filter(Boolean)
        .join("&");
      const res = await fetch(`${API}/reconciliation${params ? `?${params}` : ""}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch reports");
      const data = await res.json();
      set({ savedReports: data.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  clearReport: () => set({ currentReport: null, error: null }),
}));
