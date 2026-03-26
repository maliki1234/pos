import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const API = process.env.NEXT_PUBLIC_API_URL;

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface Store {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number; transactions: number };
  users?: { id: string; name: string; email: string; role: string; isActive: boolean }[];
}

interface StoreState {
  stores: Store[];
  loading: boolean;
  error: string;

  fetchStores: () => Promise<void>;
  createStore: (data: { name: string; address?: string; phone?: string }) => Promise<Store>;
  updateStore: (storeId: string, data: { name?: string; address?: string; phone?: string; isDefault?: boolean }) => Promise<void>;
  deactivateStore: (storeId: string) => Promise<void>;
  assignUser: (userId: string, storeId: string | null) => Promise<void>;
}

export const useStoreStore = create<StoreState>((set, get) => ({
  stores: [],
  loading: false,
  error: "",

  fetchStores: async () => {
    set({ loading: true, error: "" });
    try {
      const res = await fetch(`${API}/stores`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load stores");
      set({ stores: data.data });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  createStore: async (payload) => {
    const res = await fetch(`${API}/stores`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to create store");
    set((s) => ({ stores: [...s.stores, data.data] }));
    return data.data;
  },

  updateStore: async (storeId, payload) => {
    const res = await fetch(`${API}/stores/${storeId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update store");
    set((s) => ({
      stores: s.stores.map((st) =>
        st.id === storeId
          ? { ...st, ...data.data, ...(payload.isDefault ? {} : {}) }
          : payload.isDefault ? { ...st, isDefault: false } : st
      ),
    }));
    // Refresh to ensure consistent default state
    get().fetchStores();
  },

  deactivateStore: async (storeId) => {
    const res = await fetch(`${API}/stores/${storeId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to deactivate store");
    set((s) => ({ stores: s.stores.filter((st) => st.id !== storeId) }));
  },

  assignUser: async (userId, storeId) => {
    const res = await fetch(`${API}/stores/assign-user`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ userId, storeId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to assign user");
  },
}));
