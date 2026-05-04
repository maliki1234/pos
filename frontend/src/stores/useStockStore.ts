import { create } from "zustand";
import { db, StoredStock } from "../lib/db";
import { calculateAvailableQuantity, isOfflineFallbackError } from "@/lib/syncHelpers";
import { useAuthStore } from "./useAuthStore";
import { useProductsStore } from "./useProductsStore";

interface LowStockProduct {
  id: number;
  name: string;
  reorderPoint: number;
  totalQuantity: number;
}

interface StockState {
  stock: StoredStock[];
  lowStockProducts: LowStockProduct[];
  lowStockCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadStockByProduct: (productId: number, storeId?: string) => Promise<void>;
  fetchLowStockProducts: (storeId?: string) => Promise<void>;
  setReorderPoint: (productId: number, reorderPoint: number, storeId?: string) => Promise<void>;
  addStock: (data: {
    productId: number;
    storeId?: string;
    quantity: number;
    unitCost: number;
    expiryDate?: Date;
    notes?: string;
  }) => Promise<void>;
  getTotalQuantity: (productId: number, storeId?: string) => Promise<number>;
  getAvailableStock: (productId: number, storeId?: string) => Promise<StoredStock[]>;
  deductStockFIFO: (productId: number, quantity: number, storeId?: string) => Promise<StoredStock[]>;
  updateStock: (id: string, quantity: number) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  syncStock: () => Promise<void>;
  updateProductStockSummary: (productId: number, storeId?: string) => Promise<void>;
}

function withStoreParam(url: string, storeId?: string) {
  if (!storeId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}storeId=${encodeURIComponent(storeId)}`;
}

function stockMatchesStore(item: StoredStock, storeId?: string) {
  return !storeId || item.storeId === storeId;
}

/**
 * useStockStore - Zustand store for managing inventory stock and batches
 * Handles CRUD operations for stock batches, FIFO deduction, and offline synchronization.
 * Syncs with backend API and maintains local IndexedDB cache for offline functionality.
 */
export const useStockStore = create<StockState>((set, get) => ({
  stock: [],
  lowStockProducts: [],
  lowStockCount: 0,
  isLoading: false,
  error: null,

  // Keep the product summary in sync because the cashier reads stock from
  // product.stock.quantity, not directly from the stock batch table.
  updateProductStockSummary: async (productId: number, storeId?: string) => {
    const stockItems = await db.stock.where("productId").equals(productId).toArray();
    const scopedStockItems = stockItems.filter((item) => stockMatchesStore(item, storeId));
    const stockTableQuantity = scopedStockItems.reduce((sum, item) => {
      if (!item.isActive) return sum;
      return sum + Math.max(0, Number(item.quantity) - Number(item.quantityUsed || 0));
    }, 0);
    const product = await db.products.get(productId);
    if (product) {
      const queuedTransactions = await db.syncQueue.where("type").equals("TRANSACTION").toArray();
      const pendingTransactionQuantity = queuedTransactions.reduce((sum, item) => {
        if (storeId && item.data?.storeId !== storeId) return sum;
        const quantity = (item.data?.items || []).reduce((lineSum: number, line: any) => {
          return Number(line.productId) === productId ? lineSum + Number(line.quantity || 0) : lineSum;
        }, 0);
        return sum + quantity;
      }, 0);
      const fallbackQuantity = Number(product.stock?.serverQuantity ?? product.stock?.quantity ?? 0);
      const baseQuantity = scopedStockItems.length > 0 ? stockTableQuantity : fallbackQuantity;
      const totalQuantity = calculateAvailableQuantity({ baseQuantity, pendingTransactionQuantity });
      const stock = {
        ...product.stock,
        quantity: totalQuantity,
        serverQuantity: product.stock?.serverQuantity ?? baseQuantity,
      };

      await db.products.put({ ...product, stock });
      useProductsStore.setState((state) => ({
        products: state.products.map((p) =>
          p.id === productId ? { ...p, stock } : p
        ),
      }));
    }
  },

  fetchLowStockProducts: async (storeId?: string) => {
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(withStoreParam(`${process.env.NEXT_PUBLIC_API_URL}/stock/low-stock`, storeId), { headers });
      if (!res.ok) return;
      const data = await res.json();
      const products: LowStockProduct[] = (data.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        reorderPoint: p.reorderPoint,
        totalQuantity: p.totalQuantity,
      }));
      set({ lowStockProducts: products, lowStockCount: products.length });
    } catch {
      // Silently fail — low stock badge is non-critical
    }
  },

  setReorderPoint: async (productId: number, reorderPoint: number, storeId?: string) => {
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/stock/reorder-point/${productId}`,
        { method: "PATCH", headers, body: JSON.stringify({ reorderPoint }) }
      );
      if (!res.ok) throw new Error("Failed to update reorder point");
      // Refresh the low stock list
      await get().fetchLowStockProducts(storeId);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  /**
   * Loads all stock batches for a specific product from the API or cache.
   * Transforms the data and stores it in IndexedDB for offline access.
   * Falls back to cached data if API is unavailable.
   *
   * @param {string} productId - The ID of the product to load stock for
   */
  loadStockByProduct: async (productId: number, storeId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Try API first
      const response = await fetch(
        withStoreParam(`${process.env.NEXT_PUBLIC_API_URL}/stock?productId=${productId}`, storeId),
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        const stockItems = data.data || [];

        // Transform and save to IndexedDB
        const transformedStock = stockItems.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          storeId: item.storeId,
          batchNumber: item.batchNumber,
          quantity: item.quantity,
          quantityUsed: item.quantityUsed || 0,
          unitCost: item.unitCost,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).getTime() : undefined,
          receivedDate: item.receivedDate ? new Date(item.receivedDate).getTime() : Date.now(),
          notes: item.notes,
          isActive: item.isActive ?? true,
          lastSynced: Date.now(),
        }));

        await Promise.all(transformedStock.map((item: any) => db.stock.put(item)));
        await get().updateProductStockSummary(productId, storeId);
        set((state) => ({
          stock: [
            ...state.stock.filter((item) => item.productId !== productId || !stockMatchesStore(item, storeId)),
            ...transformedStock,
          ],
          isLoading: false,
        }));
      } else {
        throw new Error("Failed to fetch stock");
      }
    } catch (error: any) {
      // Fall back to IndexedDB
      const cached = (await db.stock.where("productId").equals(productId).toArray()).filter((item) => stockMatchesStore(item, storeId));
      set((state) => ({
        stock: [
          ...state.stock.filter((item) => item.productId !== productId || !stockMatchesStore(item, storeId)),
          ...cached,
        ],
        error: cached.length > 0 ? "Using offline cache" : error.message,
        isLoading: false,
      }));
    }
  },

  /**
   * Adds a new stock batch for a product.
   * Creates the batch on the API and stores it locally in IndexedDB.
   * Supports offline mode by saving to local DB when API is unavailable.
   * Auto-generates batch numbers sequentially per product.
   *
   * @param {Object} data - Stock data to add
   * @param {string} data.productId - ID of the product
   * @param {number} data.quantity - Initial quantity for the batch
   * @param {number} data.unitCost - Cost per unit
   * @param {Date} [data.expiryDate] - Optional expiry date
   * @param {string} [data.notes] - Optional notes (supplier, location, etc.)
  */
  addStock: async (data) => {
    set({ isLoading: true, error: null });
    const payload = {
      productId: data.productId,
      storeId: data.storeId,
      quantity: data.quantity,
      unitCost: data.unitCost,
      expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString() : undefined,
      notes: data.notes,
    };
    try {
      // Try API first
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/batch`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to add stock");
      }

      const result = await response.json();
      const newStock = result.data;

      const transformedStock: StoredStock = {
        id: newStock.id,
        productId: newStock.productId,
        storeId: newStock.storeId,
        batchNumber: newStock.batchNumber.toString(),
        quantity: newStock.quantity,
        quantityUsed: 0,
        unitCost: newStock.unitCost,
        expiryDate: newStock.expiryDate ? new Date(newStock.expiryDate).getTime() : undefined,
        receivedDate: newStock.receivedDate
          ? new Date(newStock.receivedDate).getTime()
          : Date.now(),
        notes: newStock.notes,
        isActive: newStock.isActive,
        lastSynced: Date.now(),
      };

      await db.stock.put(transformedStock);
      await get().updateProductStockSummary(data.productId, data.storeId);
      await get().loadStockByProduct(data.productId, data.storeId);
      set({ isLoading: false });
    } catch (error: any) {
      if (!isOfflineFallbackError(error)) {
        set({ isLoading: false, error: error.message });
        throw error;
      }
      // Fallback: save offline
      const offlineId = `offline_${Date.now()}_${Math.random()}`;
      const offlineStock: StoredStock = {
        id: offlineId,
        productId: data.productId,
        storeId: data.storeId,
        batchNumber: `OFFLINE-${Date.now()}`, // Will be replaced when synced
        quantity: data.quantity,
        quantityUsed: 0,
        unitCost: data.unitCost,
        expiryDate: data.expiryDate?.getTime(),
        receivedDate: Date.now(),
        notes: data.notes,
        isActive: true,
        lastSynced: Date.now(),
      };

      await db.stock.put(offlineStock);
      await db.syncQueue.put({
        id: `sync_stock_${offlineId}`,
        type: "STOCK",
        action: "CREATE",
        data: {
          localStockId: offlineId,
          payload,
        },
        createdAt: Date.now(),
        attempts: 0,
      });
      await get().updateProductStockSummary(data.productId, data.storeId);
      await get().loadStockByProduct(data.productId, data.storeId);
      set({ isLoading: false, error: "Stock saved offline - will sync when online" });
    }
  },

  /**
   * Calculates the total available quantity for a product across all batches.
   * Takes into account both current quantity and quantity already used.
   *
   * @param {string} productId - ID of the product
   * @returns {Promise<number>} Total available quantity
   */
  getTotalQuantity: async (productId: number, storeId?: string) => {
    const stockItems = await db.stock.where("productId").equals(productId).toArray();
    return stockItems
      .filter((item) => stockMatchesStore(item, storeId))
      .reduce((sum, item) => sum + (item.quantity - item.quantityUsed), 0);
  },

  /**
   * Retrieves all available stock for a product sorted in FIFO order.
   * Returns only active batches that have remaining quantity.
   * Oldest batches are returned first (by receivedDate).
   *
   * @param {string} productId - ID of the product
   * @returns {Promise<StoredStock[]>} Array of available stock batches in FIFO order
   */
  getAvailableStock: async (productId: number, storeId?: string) => {
    // Get all active stock sorted by receivedDate (FIFO - oldest first)
    const stockItems = await db.stock
      .where("productId")
      .equals(productId)
      .filter((item) => stockMatchesStore(item, storeId) && item.isActive && item.quantity > item.quantityUsed)
      .toArray();

    // Sort by received date (oldest first) for FIFO
    return stockItems.sort((a, b) => a.receivedDate - b.receivedDate);
  },

  /**
   * Deducts stock quantity using FIFO (First In First Out) algorithm.
   * Reduces oldest batches first until the required quantity is deducted.
   * Throws error if insufficient stock is available.
   *
   * @param {string} productId - ID of the product
   * @param {number} quantity - Amount of stock to deduct
   * @returns {Promise<StoredStock[]>} Array of stock batches that were used
   * @throws {Error} If insufficient stock is available
   */
  deductStockFIFO: async (productId: number, quantity: number, storeId?: string) => {
    let remainingQty = quantity;
    const usedStock: StoredStock[] = [];

    // Get available stock in FIFO order
    const availableStock = await get().getAvailableStock(productId, storeId);

    for (const stockItem of availableStock) {
      if (remainingQty <= 0) break;

      const availableQty = stockItem.quantity - stockItem.quantityUsed;
      const qtyToUse = Math.min(remainingQty, availableQty);

      // Update stock
      stockItem.quantityUsed += qtyToUse;
      await db.stock.put(stockItem);
      await get().updateProductStockSummary(productId, storeId);
      usedStock.push(stockItem);

      remainingQty -= qtyToUse;
    }

    if (remainingQty > 0) {
      throw new Error(`Insufficient stock. Needed: ${quantity}, Available: ${quantity - remainingQty}`);
    }

    return usedStock;
  },

  /**
   * Updates the quantity used for a specific stock batch.
   * Sends update to API and updates local cache.
   *
   * @param {string} id - ID of the stock batch to update
   * @param {number} quantity - New quantity value to set
   */
  updateStock: async (id: string, quantity: number) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/batch/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ quantityUsed: quantity }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stock");
      }

      const stock = await db.stock.get(id);
      if (stock) {
        await db.stock.put({ ...stock, quantity });
        await get().updateProductStockSummary(stock.productId, stock.storeId);
      }
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  deleteStock: async (id: string) => {
    set({ isLoading: true, error: null });
    const existing = await db.stock.get(id);
    if (existing) {
      const pendingTransactions = await db.syncQueue.where("type").equals("TRANSACTION").toArray();
      const hasPendingSale = pendingTransactions.some((item) =>
        (item.data?.items || []).some((line: any) => Number(line.productId) === existing.productId)
      );
      if (hasPendingSale) {
        const message = "Sync pending sales before deleting stock for this product";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    }

    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock/batch/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to delete stock batch");
      }

      await db.stock.delete(id);
      set((state) => ({
        stock: state.stock.filter((item) => item.id !== id),
        isLoading: false,
      }));
      if (existing) {
        await get().updateProductStockSummary(existing.productId, existing.storeId);
      }
    } catch (error: any) {
      if (!isOfflineFallbackError(error)) {
        set({ error: error.message, isLoading: false });
        throw error;
      }

      const pendingCreates = await db.syncQueue.where("type").equals("STOCK").toArray();
      const pendingCreate = pendingCreates.find((item) => item.data?.localStockId === id);

      if (pendingCreate) {
        await db.syncQueue.delete(pendingCreate.id);
      } else {
        await db.syncQueue.put({
          id: `sync_stock_delete_${id}`,
          type: "STOCK",
          action: "DELETE",
          data: { id, productId: existing?.productId },
          createdAt: Date.now(),
          attempts: 0,
        });
      }

      await db.stock.delete(id);
      set((state) => ({
        stock: state.stock.filter((item) => item.id !== id),
        isLoading: false,
        error: "Stock batch deleted offline - will sync when online",
      }));
      if (existing) {
        await get().updateProductStockSummary(existing.productId, existing.storeId);
      }
    }
  },

  /**
   * Syncs all stock data from the API to the local cache.
   * Transforms API responses and updates IndexedDB.
   * Called periodically or when coming online to ensure local cache is up-to-date.
   */
  syncStock: async () => {
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stock`, { headers });
      if (response.ok) {
        const data = await response.json();
        const stockItems = data.data || [];

        const transformedStock = stockItems.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          storeId: item.storeId,
          batchNumber: item.batchNumber,
          quantity: item.quantity,
          quantityUsed: item.quantityUsed || 0,
          unitCost: item.unitCost,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).getTime() : undefined,
          receivedDate: item.receivedDate ? new Date(item.receivedDate).getTime() : Date.now(),
          notes: item.notes,
          isActive: item.isActive ?? true,
          lastSynced: Date.now(),
        }));

        const pendingStockCreates = await db.syncQueue.where("type").equals("STOCK").toArray();
        const pendingLocalStockIds = new Set(
          pendingStockCreates
            .map((item) => item.data?.localStockId)
            .filter((id): id is string => typeof id === "string")
        );
        const localPendingStock = (await db.stock.toArray()).filter((item) => pendingLocalStockIds.has(item.id));

        await db.stock.clear();
        await Promise.all([...transformedStock, ...localPendingStock].map((item: any) => db.stock.put(item)));
        const productIds = [...new Set<number>(
          [...transformedStock, ...localPendingStock].map((item: any) => Number(item.productId))
        )];
        await Promise.all(productIds.map((productId) => get().updateProductStockSummary(productId)));
        set({ stock: [...transformedStock, ...localPendingStock] });
      }
    } catch (error) {
      console.error("Error syncing stock:", error);
    }
  },
}));
