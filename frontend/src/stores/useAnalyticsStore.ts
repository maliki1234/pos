import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const API = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface DashboardStats {
  todayRevenue: number;
  transactionCount: number;
  avgOrder: number;
  lowStockCount: number;
}

interface SalesTrendPoint {
  date: string;
  totalRevenue: number;
  transactionCount: number;
}

interface TopProduct {
  productId: number;
  name: string;
  totalQty: number;
  totalRevenue: number;
}

interface PaymentBreakdown {
  paymentMethod: string;
  totalAmount: number;
  count: number;
}

interface ProfitEntry {
  productId: number;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
}

interface ProfitSummary {
  revenue: number;
  productCost: number;
  grossProfit: number;
  runningCosts: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
}

interface StaffPerformance {
  userId: string;
  name: string;
  role: string;
  totalRevenue: number;
  transactionCount: number;
  avgTransaction: number;
}

interface AnalyticsState {
  dashboardStats: DashboardStats | null;
  salesTrend: SalesTrendPoint[];
  topProducts: TopProduct[];
  paymentBreakdown: PaymentBreakdown[];
  profitData: ProfitEntry[];
  profitSummary: ProfitSummary | null;
  staffPerformance: StaffPerformance[];
  isLoading: boolean;
  error: string | null;

  fetchDashboardStats: () => Promise<void>;
  fetchSalesTrend: (startDate?: string, endDate?: string) => Promise<void>;
  fetchTopProducts: (limit?: number, startDate?: string, endDate?: string) => Promise<void>;
  fetchPaymentBreakdown: (startDate?: string, endDate?: string) => Promise<void>;
  fetchProfitReport: (startDate?: string, endDate?: string) => Promise<void>;
  fetchStaffPerformance: (startDate?: string, endDate?: string) => Promise<void>;
}

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return q ? `?${q}` : "";
};

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  dashboardStats: null,
  salesTrend: [],
  topProducts: [],
  paymentBreakdown: [],
  profitData: [],
  profitSummary: null,
  staffPerformance: [],
  isLoading: false,
  error: null,

  fetchDashboardStats: async () => {
    try {
      const res = await fetch(`${API}/analytics/dashboard`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      set({ dashboardStats: data.data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchSalesTrend: async (startDate, endDate) => {
    set({ isLoading: true });
    try {
      const q = buildQuery({ startDate, endDate });
      const res = await fetch(`${API}/analytics/sales-trend${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch sales trend");
      const data = await res.json();
      set({ salesTrend: data.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchTopProducts: async (limit = 10, startDate, endDate) => {
    set({ isLoading: true });
    try {
      const q = buildQuery({ limit, startDate, endDate });
      const res = await fetch(`${API}/analytics/top-products${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch top products");
      const data = await res.json();
      set({ topProducts: data.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchPaymentBreakdown: async (startDate, endDate) => {
    set({ isLoading: true });
    try {
      const q = buildQuery({ startDate, endDate });
      const res = await fetch(`${API}/analytics/payment-breakdown${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch payment breakdown");
      const data = await res.json();
      set({ paymentBreakdown: data.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchProfitReport: async (startDate, endDate) => {
    set({ isLoading: true });
    try {
      const q = buildQuery({ startDate, endDate });
      const res = await fetch(`${API}/analytics/profit${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch profit report");
      const data = await res.json();
      set({ profitData: data.data, profitSummary: data.summary ?? null, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchStaffPerformance: async (startDate, endDate) => {
    set({ isLoading: true });
    try {
      const q = buildQuery({ startDate, endDate });
      const res = await fetch(`${API}/analytics/staff${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch staff performance");
      const data = await res.json();
      set({ staffPerformance: data.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
}));
