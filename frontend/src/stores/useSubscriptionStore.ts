import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

const API = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface SubscriptionPayment {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
  confirmedBy?: string;
  confirmer?: { id: string; name: string };
  notes?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  plan: 'STARTER' | 'BUSINESS' | 'ENTERPRISE';
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
  billingCycle: string;
  currency: string;
  amount: number;
  startDate: string;
  endDate?: string;
  trialEndsAt?: string;
  cancelledAt?: string;
  notes?: string;
  payments: SubscriptionPayment[];
}

interface SubscriptionState {
  subscription: Subscription | null;
  payments: SubscriptionPayment[];
  isLoading: boolean;
  error: string | null;

  fetchCurrent: () => Promise<void>;
  fetchPayments: () => Promise<void>;
  changePlan: (plan: string, billingCycle: string, currency: string) => Promise<void>;
  recordPayment: (data: {
    amount: number; currency: string; paymentMethod: string;
    reference?: string; periodStart: string; periodEnd: string; notes?: string;
  }) => Promise<void>;
  confirmPayment: (paymentId: string, notes?: string) => Promise<void>;
  failPayment: (paymentId: string) => Promise<void>;
  refundPayment: (paymentId: string) => Promise<void>;
  suspend: (notes?: string) => Promise<void>;
  reinstate: () => Promise<void>;
  cancel: (notes?: string) => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: null,
  payments: [],
  isLoading: false,
  error: null,

  fetchCurrent: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/subscription`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch subscription');
      const data = await res.json();
      set({ subscription: data.data, isLoading: false });
    } catch (err: any) { set({ error: err.message, isLoading: false }); }
  },

  fetchPayments: async () => {
    try {
      const res = await fetch(`${API}/subscription/payments`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch payments');
      const data = await res.json();
      set({ payments: data.data });
    } catch (err: any) { set({ error: err.message }); }
  },

  changePlan: async (plan, billingCycle, currency) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API}/subscription/change-plan`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ plan, billingCycle, currency }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      const data = await res.json();
      set({ subscription: data.data, isLoading: false });
    } catch (err: any) { set({ error: err.message, isLoading: false }); throw err; }
  },

  recordPayment: async (payload) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API}/subscription/payments`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      await get().fetchPayments();
      set({ isLoading: false });
    } catch (err: any) { set({ error: err.message, isLoading: false }); throw err; }
  },

  confirmPayment: async (paymentId, notes) => {
    const res = await fetch(`${API}/subscription/payments/${paymentId}/confirm`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ notes }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    await get().fetchCurrent();
    await get().fetchPayments();
  },

  failPayment: async (paymentId) => {
    const res = await fetch(`${API}/subscription/payments/${paymentId}/fail`, {
      method: 'POST', headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed');
    await get().fetchPayments();
  },

  refundPayment: async (paymentId) => {
    const res = await fetch(`${API}/subscription/payments/${paymentId}/refund`, {
      method: 'POST', headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed');
    await get().fetchPayments();
  },

  suspend: async (notes) => {
    const res = await fetch(`${API}/subscription/suspend`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error('Failed');
    await get().fetchCurrent();
  },

  reinstate: async () => {
    const res = await fetch(`${API}/subscription/reinstate`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    await get().fetchCurrent();
  },

  cancel: async (notes) => {
    const res = await fetch(`${API}/subscription/cancel`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error('Failed');
    await get().fetchCurrent();
  },
}));
