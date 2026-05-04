import { create } from "zustand";
import { db } from "../lib/db";

const API = process.env.NEXT_PUBLIC_API_URL;

interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  storeId?: string | null;
  businessId: string;
  businessName: string;
  currency?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isPinLocked: boolean;
  hasPinSet: boolean;
  showReauthBanner: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  registerBusiness: (businessName: string, email: string, password: string, name: string, country?: string, currency?: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  updateProfile: (data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
  restoreSession: () => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  dismissReauthBanner: () => void;
}

async function hashPin(pin: string): Promise<string> {
  const encoded = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function saveSession(token: string, user: User) {
  localStorage.setItem("userSession", JSON.stringify({ token, user }));
  await db.userSession.put({
    id: "current",
    userId: user.id,
    businessId: user.businessId,
    businessName: user.businessName,
    email: user.email,
    name: user.name,
    role: user.role,
    storeId: user.storeId,
    token,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isPinLocked: false,
  hasPinSet: false,
  showReauthBanner: false,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login failed");
      }
      const data = await res.json();
      const user: User = data.data.user;
      const token: string = data.data.token;
      await saveSession(token, user);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  registerBusiness: async (businessName, email, password, name, country, currency) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API}/auth/register-business`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, email, password, name, country, currency }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      const data = await res.json();
      const user: User = data.data.user;
      const token: string = data.data.token;
      await saveSession(token, user);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  register: async (email, password, name, role) => {
    set({ isLoading: true, error: null });
    try {
      const token = get().token;
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, password, name, role }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const token = get().token;
      const res = await fetch(`${API}/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Failed to update profile");

      const user: User = body.data.user;
      const nextToken: string = body.data.token;
      await saveSession(nextToken, user);
      set({ user, token: nextToken, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    localStorage.removeItem("userSession");
    await db.userSession.clear();
    set({ user: null, token: null, isAuthenticated: false, error: null, isPinLocked: false, hasPinSet: false });
  },

  setPin: async (pin: string) => {
    const pinHash = await hashPin(pin);
    await db.userSession.update("current", { pinHash });
    set({ hasPinSet: true });
  },

  verifyPin: async (pin: string) => {
    const stored = await db.userSession.get("current");
    if (!stored?.pinHash) return false;
    const hash = await hashPin(pin);
    if (hash !== stored.pinHash) return false;
    set({ isPinLocked: false, isAuthenticated: true, showReauthBanner: true });
    return true;
  },

  dismissReauthBanner: () => set({ showReauthBanner: false }),

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const stored = await db.userSession.get("current");
      if (stored) {
        if (stored.expiresAt < Date.now()) {
          // Offline + PIN set → enter PIN lock mode instead of logging out
          if (!navigator.onLine && stored.pinHash) {
            set({
              isPinLocked: true,
              hasPinSet: true,
              isAuthenticated: false,
              isLoading: false,
              user: {
                id: stored.userId,
                businessId: stored.businessId,
                businessName: stored.businessName,
                email: stored.email,
                name: stored.name,
                role: stored.role,
                storeId: stored.storeId,
              },
              token: stored.token,
            });
            return;
          }
          await db.userSession.clear();
          localStorage.removeItem("userSession");
          set({ isLoading: false });
          return;
        }
        set({
          user: {
            id: stored.userId,
            businessId: stored.businessId,
            businessName: stored.businessName,
            email: stored.email,
            name: stored.name,
            role: stored.role,
            storeId: stored.storeId,
          },
          token: stored.token,
          isAuthenticated: true,
          isLoading: false,
          hasPinSet: !!stored.pinHash,
        });
        return;
      }

      const session = localStorage.getItem("userSession");
      if (session) {
        const { user, token } = JSON.parse(session);
        await saveSession(token, user);
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
