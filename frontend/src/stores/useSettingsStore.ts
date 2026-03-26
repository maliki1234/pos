"use client";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";

const API = process.env.NEXT_PUBLIC_API_URL;

export interface BusinessSettings {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string;
  currency: string;
  // eTIMS
  etimsEnabled: boolean;
  etimsPin: string | null;
  etimsBhfId: string | null;
  // M-Pesa
  mpesaEnabled: boolean;
  mpesaShortcode: string | null;
  mpesaCallbackUrl: string | null;
  mpesaConsumerKey: string | null;
  mpesaPasskey: string | null;
  mpesaConsumerKeySet: boolean;
  mpesaPasskeySet: boolean;
  // Azampay
  azampayEnabled: boolean;
  azampayAppName: string | null;
  azampayClientId: string | null;
  azampayClientSecret: string | null;
  azampayCallbackUrl: string | null;
}

interface SettingsState {
  settings: BusinessSettings | null;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<BusinessSettings> & { mpesaConsumerKey?: string; mpesaConsumerSecret?: string }) => Promise<void>;
}

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${useAuthStore.getState().token}`,
});

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API}/settings`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        set({ settings: data.data });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (data) => {
    const res = await fetch(`${API}/settings`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to update settings");
    }
  },
}));
