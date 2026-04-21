import { create } from "zustand";
import { db } from "../lib/db";
import { useAuthStore } from "./useAuthStore";
import { useCategoriesStore } from "./useCategoriesStore";
import { useProductsStore } from "./useProductsStore";
import { useSettingsStore } from "./useSettingsStore";
import { useStoreStore } from "./useStoreStore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
const HEALTH_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, "") + "/health";

async function canReachBackend(timeoutMs = 4000) {
  if (typeof window !== "undefined" && !navigator.onLine) return false;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(HEALTH_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  isPreloading: boolean;
  pendingCount: number;
  lastSyncTime?: number;
  lastPreloadTime?: number;
  error?: string;

  // Actions
  initializeSync: () => void;
  checkConnection: () => Promise<boolean>;
  preloadOfflineData: () => Promise<void>;
  syncPendingTransactions: () => Promise<void>;
  getPendingCount: () => Promise<number>;
  clearOldSyncData: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof window !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  isPreloading: false,
  pendingCount: 0,
  lastSyncTime: undefined,
  lastPreloadTime: undefined,
  error: undefined,

  initializeSync: () => {
    if (typeof window === "undefined") return;

    let isCheckingConnection = false;
    const refreshConnection = async () => {
      if (isCheckingConnection) return get().isOnline;
      isCheckingConnection = true;
      const wasOnline = get().isOnline;
      const isReachable = await canReachBackend();
      isCheckingConnection = false;

      set({ isOnline: isReachable, error: isReachable ? undefined : get().error });
      if (isReachable && !wasOnline) {
        console.log("Backend reachable - starting sync");
        const { isPinLocked, showReauthBanner } = useAuthStore.getState();
        if (isPinLocked || showReauthBanner) {
          useAuthStore.setState({ showReauthBanner: true });
        }
        get().syncPendingTransactions();
      }
      return isReachable;
    };

    window.addEventListener("online", () => {
      refreshConnection();
    });

    window.addEventListener("offline", () => {
      set({ isOnline: false });
      console.log("Offline mode activated");
    });

    window.addEventListener("pos-sync-requested", () => {
      get().syncPendingTransactions();
    });

    // Periodic connection and sync check every 30 seconds
    setInterval(() => {
      refreshConnection().then((isReachable) => {
        if (isReachable && !get().isSyncing) {
          get().syncPendingTransactions();
        }
      });
    }, 30000);

    refreshConnection();

    // Initial pending count
    get().getPendingCount();
    db.offlineMeta.get("lastPreloadTime").then((meta) => {
      if (meta?.value) set({ lastPreloadTime: Number(meta.value) });
    });
  },

  checkConnection: async () => {
    const isReachable = await canReachBackend();
    set({ isOnline: isReachable, error: isReachable ? undefined : get().error });
    return isReachable;
  },

  preloadOfflineData: async () => {
    if (get().isPreloading) return;
    const isReachable = await get().checkConnection();
    if (!isReachable) return;

    set({ isPreloading: true, error: undefined });
    try {
      await Promise.allSettled([
        useProductsStore.getState().loadProducts(),
        useCategoriesStore.getState().loadCategories(),
        useSettingsStore.getState().fetchSettings(),
        useStoreStore.getState().fetchStores(),
      ]);

      const timestamp = Date.now();
      await db.offlineMeta.put({
        key: "lastPreloadTime",
        value: timestamp,
        updatedAt: timestamp,
      });
      set({ lastPreloadTime: timestamp, isPreloading: false });
      await get().getPendingCount();
    } catch (error: any) {
      set({ error: error.message, isPreloading: false });
    }
  },

  getPendingCount: async () => {
    try {
      const queued = await db.syncQueue.toArray();
      const pending = queued.filter((q) => q.attempts < 3);
      set({ pendingCount: pending.length });
      return pending.length;
    } catch (error) {
      console.error("Error getting pending count:", error);
      return 0;
    }
  },

  syncPendingTransactions: async () => {
    if (get().isSyncing) return;
    const isReachable = await get().checkConnection();
    if (!isReachable) return;

    set({ isSyncing: true, error: undefined });

    try {
      const queuedItems = await db.syncQueue.where("attempts").below(3).toArray();

      for (const item of queuedItems) {
        try {
          const authToken = useAuthStore.getState().token;

          // Strip offline-only fields before sending to API
          const payload = item.type === "TRANSACTION" ? {
            storeId:               item.data.storeId,
            customerId:            item.data.customerId,
            items:                 item.data.items?.map((i: any) => ({
              productId: i.productId,
              quantity:  i.quantity,
              discount:  i.discount,
            })),
            paymentMethod:         item.data.paymentMethod,
            payments:              item.data.payments,
            mpesaRef:              item.data.mpesaRef,
            dueDate:               item.data.dueDate,
            loyaltyPointsToRedeem: item.data.loyaltyPointsToRedeem,
            notes:                 item.data.notes,
          } : item.data;

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/${item.type.toLowerCase()}s`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify(payload),
            }
          );

          if (response.ok) {
            // Update transaction status
            if (item.type === "TRANSACTION" && item.data.offlineId) {
              await db.transactions.update(item.data.offlineId, {
                syncStatus: "SYNCED",
                syncedAt: Date.now(),
              });
            }

            // Remove from queue
            await db.syncQueue.delete(item.id);
            console.log(`Synced ${item.type}: ${item.id}`);
          } else {
            // Increment attempts
            await db.syncQueue.update(item.id, {
              attempts: item.attempts + 1,
              lastError: `HTTP ${response.status}`,
            });
          }
        } catch (error: any) {
          // Update with error info
          await db.syncQueue.update(item.id, {
            attempts: item.attempts + 1,
            lastError: error.message,
          });
          console.error(`Error syncing ${item.type}:`, error);
        }
      }

      set({
        lastSyncTime: Date.now(),
        isSyncing: false,
      });

      // Update pending count
      await get().getPendingCount();
      await get().preloadOfflineData();
    } catch (error: any) {
      set({
        error: error.message,
        isSyncing: false,
      });
      console.error("Sync error:", error);
    }
  },

  clearOldSyncData: async () => {
    try {
      // Clear sync queue items older than 7 days that are synced
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const items = await db.syncQueue.where("createdAt").below(weekAgo).toArray();

      await Promise.all(
        items.map((item) => {
          if (item.attempts >= 3 || item.attempts === 0) {
            return db.syncQueue.delete(item.id);
          }
          return Promise.resolve();
        })
      );

      // Clear old transactions (older than 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      await db.transactions.where("createdAt").below(thirtyDaysAgo).delete();
    } catch (error) {
      console.error("Error clearing old sync data:", error);
    }
  },
}));
