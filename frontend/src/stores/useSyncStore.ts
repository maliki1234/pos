import { create } from "zustand";
import { db } from "../lib/db";
import { sortSyncQueueItems } from "@/lib/syncHelpers";
import { useAuthStore } from "./useAuthStore";
import { useCategoriesStore } from "./useCategoriesStore";
import { transformApiProduct, useProductsStore } from "./useProductsStore";
import { useSettingsStore } from "./useSettingsStore";
import { useStockStore } from "./useStockStore";
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

interface PendingSyncItem {
  id: string;
  type: string;
  action: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  isPreloading: boolean;
  pendingCount: number;
  pendingItems: PendingSyncItem[];
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
  pendingItems: [],
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
        useCategoriesStore.getState().loadCategories(),
        useSettingsStore.getState().fetchSettings(),
        useStoreStore.getState().fetchStores(),
      ]);
      await useProductsStore.getState().loadProducts();
      await useStockStore.getState().syncStock();

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
      const pendingItems = sortSyncQueueItems(queued).map((item) => ({
        id: item.id,
        type: item.type,
        action: item.action,
        createdAt: item.createdAt,
        attempts: item.attempts,
        lastError: item.lastError,
      }));
      set({ pendingCount: queued.length, pendingItems });
      return queued.length;
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
      const queuedItems = sortSyncQueueItems(await db.syncQueue.toArray());

      for (const queuedItem of queuedItems) {
        const item = await db.syncQueue.get(queuedItem.id);
        if (!item) continue;
        try {
          const authToken = useAuthStore.getState().token;
          if (!authToken) {
            useAuthStore.setState({ showReauthBanner: true });
            set({ isSyncing: false, error: "Log in again to sync offline changes." });
            return;
          }

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
          } : (item.type === "PRODUCT" || item.type === "STOCK" || item.type === "CATEGORY") && item.data?.payload ? item.data.payload : item.data;

          let endpoint = item.type === "STOCK"
            ? "stock/batch"
            : item.type === "CATEGORY"
              ? "categories"
              : `${item.type.toLowerCase()}s`;

          const method = item.action === "CREATE" ? "POST" : item.action === "UPDATE" ? "PATCH" : "DELETE";

          if (item.action === "DELETE") {
            if (item.type === "PRODUCT") endpoint = `products/${item.data.id}`;
            if (item.type === "STOCK") endpoint = `stock/batch/${item.data.id}`;
          }

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/${endpoint}`,
            {
              method,
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: method === "DELETE" ? undefined : JSON.stringify(payload),
            }
          );

          if (response.ok) {
            const synced = await response.json().catch(() => null);
            if (item.type === "CATEGORY") {
              if (item.data?.localCategoryId) {
                await db.categories.delete(item.data.localCategoryId);
              }
              if (synced?.data) {
                await db.categories.put({
                  id: synced.data.id,
                  name: synced.data.name,
                  description: synced.data.description || "",
                  isActive: synced.data.isActive ?? true,
                  lastSynced: Date.now(),
                });
                const localCategoryId = item.data?.localCategoryId;
                const serverCategoryId = synced.data.id;
                if (localCategoryId && serverCategoryId) {
                  const queued = await db.syncQueue.toArray();
                  await Promise.all(queued.map(async (queuedItem) => {
                    if (queuedItem.id === item.id) return;
                    if (queuedItem.type === "PRODUCT" && queuedItem.data?.payload?.categoryId === localCategoryId) {
                      await db.syncQueue.update(queuedItem.id, {
                        attempts: 0,
                        data: {
                          ...queuedItem.data,
                          payload: { ...queuedItem.data.payload, categoryId: serverCategoryId },
                        },
                      });
                    }
                  }));

                  const products = await db.products.toArray();
                  await Promise.all(products.map(async (product) => {
                    if (product.categoryId === localCategoryId) {
                      await db.products.update(product.id, { categoryId: serverCategoryId });
                    }
                  }));
                }
              }
            }
            // Update transaction status
            if (item.type === "TRANSACTION" && item.data.offlineId) {
              await db.transactions.update(item.data.offlineId, {
                syncStatus: "SYNCED",
                syncedAt: Date.now(),
                transactionNo: synced?.data?.transactionNo ?? item.data.transactionNo,
              });
            }
            if (item.type === "PRODUCT") {
              if (item.action === "DELETE") {
                await db.products.delete(item.data.id);
                await db.stock.where("productId").equals(item.data.id).delete();
              } else {
                if (item.data?.localProductId) {
                  await db.products.delete(item.data.localProductId);
                }
                if (synced?.data) {
                  await db.products.put(transformApiProduct(synced.data));
                  const localProductId = item.data?.localProductId;
                  const serverProductId = synced.data.id;
                  if (localProductId && serverProductId) {
                    const queued = await db.syncQueue.toArray();
                    await Promise.all(queued.map(async (queuedItem) => {
                      if (queuedItem.id === item.id) return;
                      if (queuedItem.type === "STOCK" && queuedItem.data?.payload?.productId === localProductId) {
                        await db.syncQueue.update(queuedItem.id, {
                          attempts: 0,
                          data: {
                            ...queuedItem.data,
                            payload: { ...queuedItem.data.payload, productId: serverProductId },
                          },
                        });
                      }
                      if (queuedItem.type === "TRANSACTION") {
                        const updatedItems = queuedItem.data?.items?.map((line: any) =>
                          line.productId === localProductId ? { ...line, productId: serverProductId } : line
                        );
                        if (updatedItems) {
                          await db.syncQueue.update(queuedItem.id, {
                            attempts: 0,
                            data: { ...queuedItem.data, items: updatedItems },
                          });
                        }
                      }
                    }));
                    const localTransactions = await db.transactions.toArray();
                    await Promise.all(localTransactions.map(async (txn) => {
                      const updatedItems = txn.items?.map((line: any) =>
                        line.productId === localProductId ? { ...line, productId: serverProductId } : line
                      );
                      if (updatedItems?.some((line: any, index: number) => line.productId !== txn.items[index].productId)) {
                        await db.transactions.update(txn.id, { items: updatedItems });
                      }
                    }));
                  }
                }
              }
            }
            if (item.type === "STOCK") {
              if (item.action === "DELETE") {
                await db.stock.delete(item.data.id);
                if (item.data.productId) {
                  await useStockStore.getState().updateProductStockSummary(item.data.productId);
                }
              } else {
                if (item.data?.localStockId) {
                  await db.stock.delete(item.data.localStockId);
                }
                if (synced?.data) {
                  const stock = {
                    id: synced.data.id,
                    productId: synced.data.productId,
                    batchNumber: String(synced.data.batchNumber),
                    quantity: synced.data.quantity,
                    quantityUsed: synced.data.quantityUsed || 0,
                    unitCost: synced.data.unitCost,
                    expiryDate: synced.data.expiryDate ? new Date(synced.data.expiryDate).getTime() : undefined,
                    receivedDate: synced.data.receivedDate ? new Date(synced.data.receivedDate).getTime() : Date.now(),
                    notes: synced.data.notes,
                    isActive: synced.data.isActive ?? true,
                    lastSynced: Date.now(),
                  };
                  await db.stock.put(stock);
                  await useStockStore.getState().updateProductStockSummary(stock.productId);
                }
              }
            }

            // Remove from queue
            await db.syncQueue.delete(item.id);
            console.log(`Synced ${item.type}: ${item.id}`);
          } else {
            const errorData = await response.json().catch(() => null);
            if (response.status === 401) {
              useAuthStore.setState({ showReauthBanner: true });
              set({ isSyncing: false, error: "Log in again to sync offline changes." });
              return;
            }
            // Increment attempts
            await db.syncQueue.update(item.id, {
              attempts: item.attempts + 1,
              lastError: errorData?.message || `HTTP ${response.status}`,
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
      // Never purge syncQueue here: every row represents unsynced user data.
      // Clear old synced transactions only after they are safely on the server.
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const oldTransactions = await db.transactions.where("createdAt").below(thirtyDaysAgo).toArray();
      await Promise.all(
        oldTransactions
          .filter((transaction) => transaction.syncStatus === "SYNCED")
          .map((transaction) => db.transactions.delete(transaction.id))
      );
    } catch (error) {
      console.error("Error clearing old sync data:", error);
    }
  },
}));
