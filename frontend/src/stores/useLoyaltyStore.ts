import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const API = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface LoyaltyHistory {
  id: string;
  type: "EARN" | "REDEEM" | "ADJUSTMENT" | "EXPIRE";
  points: number;
  description?: string;
  createdAt: string;
}

interface LoyaltyAccount {
  totalPoints: number;
  lifetimePoints: number;
  tier: "BRONZE" | "SILVER" | "GOLD";
  nextTierPoints: number | null;
  pointValueKES: number;
  pointsHistory: LoyaltyHistory[];
}

interface LoyaltyState {
  account: LoyaltyAccount | null;
  isLoading: boolean;
  error: string | null;

  fetchAccount: (customerId: string) => Promise<void>;
  previewRedemption: (customerId: string, points: number) => Promise<{ kesValue: number; remainingPoints: number }>;
  clearAccount: () => void;
}

export const useLoyaltyStore = create<LoyaltyState>((set) => ({
  account: null,
  isLoading: false,
  error: null,

  fetchAccount: async (customerId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/loyalty/customer/${customerId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch loyalty account");
      const data = await res.json();
      set({ account: data.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  previewRedemption: async (customerId, points) => {
    const res = await fetch(`${API}/loyalty/redeem`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ customerId, points }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Redemption failed");
    }
    const data = await res.json();
    return { kesValue: data.data.kesValue, remainingPoints: data.data.remainingPoints };
  },

  clearAccount: () => set({ account: null, error: null }),
}));
