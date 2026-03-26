import { create } from "zustand";
import { db } from "../lib/db";
import { useAuthStore } from "./useAuthStore";

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime?: number;
  error?: string;

  // Actions
  initializeSync: () => void;
  syncPendingTransactions: () => Promise<void>;
  getPendingCount: () => Promise<number>;
  clearOldSyncData: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: typeof window !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: undefined,
  error: undefined,

  initializeSync: () => {
    if (typeof window === "undefined") return;

    // Listen for online/offline events
    window.addEventListener("online", () => {
      set({ isOnline: true, error: undefined });
      console.log("Back online - starting sync");
      // If session was PIN-locked (expired token), prompt re-auth
      const { isPinLocked, showReauthBanner } = useAuthStore.getState();
      if (isPinLocked || showReauthBanner) {
        useAuthStore.setState({ showReauthBanner: true });
      }
      get().syncPendingTransactions();
    });

    window.addEventListener("offline", () => {
      set({ isOnline: false });
      console.log("Offline mode activated");
    });

    // Periodic sync check every 30 seconds when online
    setInterval(() => {
      if (get().isOnline && !get().isSyncing) {
        get().syncPendingTransactions();
      }
    }, 30000);

    // Initial pending count
    get().getPendingCount();
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
    if (!get().isOnline || get().isSyncing) return;

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
