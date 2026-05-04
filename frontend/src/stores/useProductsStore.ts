import { create } from "zustand";
import { db, StoredProduct } from "../lib/db";
import { calculateAvailableQuantity, isOfflineFallbackError } from "@/lib/syncHelpers";
import { useAuthStore } from "./useAuthStore";

export function transformApiProduct(p: any): StoredProduct {
  const retail = p.prices?.find((pr: any) => pr.customerType === 'RETAIL');
  const wholesale = p.prices?.find((pr: any) => pr.customerType === 'WHOLESALE');
  const retailPrice = retail?.unitPrice || 0;
  const wholesalePrice = wholesale?.unitPrice || retailPrice;
  const totalQuantity = (p.stock || []).reduce((sum: number, batch: any) => {
    return sum + (batch.quantity - batch.quantityUsed);
  }, 0);

  return {
    id: p.id,
    storeId: p.storeId,
    name: p.name,
    categoryId: p.categoryId,
    barcode: p.barcode,
    description: p.description,
    isActive: p.isActive,
    retail: {
      unitPrice: retailPrice,
      discount: retail?.discount || 0,
    },
    wholesale: {
      unitPrice: wholesalePrice,
      discount: wholesale?.discount || 0,
    },
    stock: {
      quantity: totalQuantity,
      serverQuantity: totalQuantity,
    },
    lastSynced: Date.now(),
  };
}

function buildProductPayload(data: {
  name: string;
  categoryId: string;
  barcode?: string;
  storeId?: string;
  retailPrice: number;
  wholesalePrice: number;
  reorderPoint?: number;
}) {
  return {
    name: data.name,
    categoryId: data.categoryId,
    storeId: data.storeId,
    barcode: data.barcode,
    description: "",
    isActive: true,
    reorderPoint: data.reorderPoint ?? 10,
    prices: [
      {
        customerType: "RETAIL",
        unitPrice: data.retailPrice,
        discount: 0,
      },
      {
        customerType: "WHOLESALE",
        unitPrice: data.wholesalePrice,
        discount: 0,
      },
    ],
  };
}

async function getPendingOfflineProducts() {
  const pendingCreates = await db.syncQueue
    .where("type")
    .equals("PRODUCT")
    .toArray();
  const localIds = pendingCreates
    .map((item) => item.data?.localProductId)
    .filter((id): id is number => typeof id === "number");

  if (localIds.length === 0) return [];

  const products = await Promise.all(localIds.map((id) => db.products.get(id)));
  return products.filter(Boolean) as StoredProduct[];
}

function withStoreParam(url: string, storeId?: string) {
  if (!storeId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}storeId=${encodeURIComponent(storeId)}`;
}

async function withQueuedInventoryAdjustments(products: StoredProduct[], storeId?: string) {
  const queued = await db.syncQueue.toArray();
  const pendingStockByProduct = new Map<number, number>();
  const pendingSalesByProduct = new Map<number, number>();

  for (const item of queued) {
    if (item.type === "STOCK" && item.action === "CREATE") {
      const productId = Number(item.data?.payload?.productId);
      const quantity = Number(item.data?.payload?.quantity || 0);
      const itemStoreId = item.data?.payload?.storeId;
      if (Number.isFinite(productId) && (!storeId || itemStoreId === storeId)) {
        pendingStockByProduct.set(productId, (pendingStockByProduct.get(productId) || 0) + quantity);
      }
    }
    if (item.type === "TRANSACTION" && item.action === "CREATE") {
      if (storeId && item.data?.storeId !== storeId) continue;
      for (const line of item.data?.items || []) {
        const productId = Number(line.productId);
        const quantity = Number(line.quantity || 0);
        if (Number.isFinite(productId)) {
          pendingSalesByProduct.set(productId, (pendingSalesByProduct.get(productId) || 0) + quantity);
        }
      }
    }
  }

  return products.map((product) => {
    const baseQuantity = Number(product.stock?.serverQuantity ?? product.stock?.quantity ?? 0);
    const quantity = calculateAvailableQuantity({
      baseQuantity,
      pendingStockQuantity: pendingStockByProduct.get(product.id) || 0,
      pendingTransactionQuantity: pendingSalesByProduct.get(product.id) || 0,
    });
    return {
      ...product,
      stock: { ...product.stock, quantity, serverQuantity: product.stock?.serverQuantity ?? baseQuantity },
    };
  });
}

async function searchCachedProducts(query: string, storeId?: string) {
  const needle = query.trim().toLowerCase();
  const cached = (await db.products.toArray()).filter((product) => !storeId || product.storeId === storeId);

  if (!needle) return cached;

  return cached
    .filter((product) => {
      const name = product.name?.toLowerCase() ?? "";
      const barcode = product.barcode?.toLowerCase() ?? "";
      return name.includes(needle) || barcode.includes(needle);
    })
    .sort((a, b) => {
      const aName = a.name?.toLowerCase() ?? "";
      const bName = b.name?.toLowerCase() ?? "";
      const aStarts = aName.startsWith(needle) ? 0 : 1;
      const bStarts = bName.startsWith(needle) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aName.localeCompare(bName);
    });
}

interface ProductsState {
  products: StoredProduct[];
  isLoading: boolean;
  error: string | null;
  lastSynced: number | null;

  // Actions
  loadProducts: (storeId?: string) => Promise<void>;
  searchProducts: (query: string, storeId?: string) => Promise<void>;
  getProductById: (id: string, storeId?: string) => Promise<StoredProduct | undefined>;
  createProduct: (data: {
    name: string;
    categoryId: string;
    barcode?: string;
    storeId?: string;
    retailPrice: number;
    wholesalePrice: number;
    reorderPoint?: number;
  }) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  syncProducts: () => Promise<void>;
  clearProducts: () => void;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  lastSynced: null,

  loadProducts: async (storeId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Try to fetch from API
      const response = await fetch(withStoreParam(`${process.env.NEXT_PUBLIC_API_URL}/products?take=1000`, storeId), { headers });

      if (response.ok) {
        const data = await response.json();
        const products = data.data;

        const pendingOfflineProducts = await getPendingOfflineProducts();
        const transformedProducts = products.map(transformApiProduct);
        const mergedProducts = await withQueuedInventoryAdjustments([...transformedProducts, ...pendingOfflineProducts], storeId);

        // Sync IndexedDB without losing locally created products that are still queued.
        await db.products.clear();
        if (mergedProducts.length > 0) {
          await Promise.all(
            mergedProducts.map((p: any) => db.products.put(p))
          );
        }

        set({
          products: mergedProducts,
          lastSynced: Date.now(),
          isLoading: false,
        });
      } else {
        throw new Error("Failed to fetch products");
      }
    } catch (error: any) {
      // Fall back to cached products from IndexedDB
      const cached = (await db.products.toArray()).filter((product) => !storeId || product.storeId === storeId);
      if (cached.length > 0) {
        set({
          products: cached,
          error: "Using offline cache",
          isLoading: false,
        });
      } else {
        set({
          error: error.message,
          isLoading: false,
        });
      }
    }
  },

  searchProducts: async (query: string, storeId?: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!query.trim()) {
        await get().loadProducts(storeId);
        return;
      }

      // First try API search
      try {
        const token = useAuthStore.getState().token;
        const headers: any = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(
          withStoreParam(`${process.env.NEXT_PUBLIC_API_URL}/products?search=${encodeURIComponent(query)}`, storeId),
          { headers }
        );
        if (response.ok) {
          const data = await response.json();
          const products = data.data;

          const transformedProducts = await withQueuedInventoryAdjustments(products.map(transformApiProduct), storeId);

          if (transformedProducts.length > 0) {
            await Promise.all(
              transformedProducts.map((p: any) => db.products.put(p))
            );
          }

          set({ products: transformedProducts, isLoading: false });
          return;
        }
      } catch (error) {
        console.warn("API search failed, falling back to local search:", error);
      }

      // Fall back to local cache. The products table is not indexed by name, so
      // filter in memory to keep offline search working on existing installs.
      const results = await searchCachedProducts(query, storeId);

      set({ products: results, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  getProductById: async (id: string, storeId?: string) => {
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Try API first
      try {
        const response = await fetch(withStoreParam(`${process.env.NEXT_PUBLIC_API_URL}/products/${parseInt(id)}`, storeId), { headers });
        if (response.ok) {
          const data = await response.json();
          const product = data.data;

          const transformedProduct = transformApiProduct(product);

          await db.products.put(transformedProduct);
          return transformedProduct;
        }
      } catch {
        // Fall back to the local cache below.
      }

      // Fall back to local cache
      const cached = await db.products.get(parseInt(id));
      return !storeId || cached?.storeId === storeId ? cached : undefined;
    } catch (error) {
      console.error("Error fetching product:", error);
      return undefined;
    }
  },

  createProduct: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Create on API first
      const payload = buildProductPayload(data);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to create product");
      }

      const result = await response.json();
      const newProduct = result.data;

      // Transform and save to IndexedDB
      const transformedProduct: StoredProduct = {
        id: newProduct.id,
        storeId: newProduct.storeId,
        name: newProduct.name,
        categoryId: newProduct.categoryId,
        barcode: newProduct.barcode || data.barcode,
        description: newProduct.description || "",
        isActive: newProduct.isActive,
        retail: {
          unitPrice: data.retailPrice,
          discount: 0,
        },
        wholesale: {
          unitPrice: data.wholesalePrice,
          discount: 0,
        },
        stock: { quantity: 0, serverQuantity: 0 },
        lastSynced: Date.now(),
      };

      await db.products.put(transformedProduct);

      // Reload products
      await get().loadProducts(data.storeId);
      set({ isLoading: false });
    } catch (error: any) {
      if (!isOfflineFallbackError(error)) {
        set({ isLoading: false, error: error.message });
        throw error;
      }
      // Fallback: save to IndexedDB with offline ID
      const localProductId = Date.now();
      const payload = buildProductPayload(data);
      const offlineProduct: StoredProduct = {
        id: localProductId,
        storeId: data.storeId,
        name: data.name,
        categoryId: data.categoryId,
        barcode: data.barcode,
        description: "",
        isActive: true,
        retail: {
          unitPrice: data.retailPrice,
          discount: 0,
        },
        wholesale: {
          unitPrice: data.wholesalePrice,
          discount: 0,
        },
        stock: { quantity: 0, serverQuantity: 0 },
        lastSynced: Date.now(),
      };

      await db.products.put(offlineProduct);
      await db.syncQueue.put({
        id: `sync_product_${localProductId}`,
        type: "PRODUCT",
        action: "CREATE",
        data: { payload, localProductId },
        createdAt: Date.now(),
        attempts: 0,
      });
      await get().loadProducts(data.storeId);
      set({ isLoading: false, error: "Product saved offline - will sync when online" });
    }
  },

  deleteProduct: async (id) => {
    set({ isLoading: true, error: null });
    const pendingTransactions = await db.syncQueue.where("type").equals("TRANSACTION").toArray();
    const hasPendingSale = pendingTransactions.some((item) =>
      (item.data?.items || []).some((line: any) => Number(line.productId) === id)
    );
    if (hasPendingSale) {
      const message = "Sync pending sales before deleting this product";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }

    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to delete product");
      }

      await db.products.delete(id);
      await db.stock.where("productId").equals(id).delete();

      set((state) => ({
        products: state.products.filter((product) => product.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      if (!isOfflineFallbackError(error)) {
        set({ error: error.message, isLoading: false });
        throw error;
      }

      const pendingCreates = await db.syncQueue.where("type").equals("PRODUCT").toArray();
      const pendingCreate = pendingCreates.find((item) => item.data?.localProductId === id);

      if (pendingCreate) {
        await db.syncQueue.delete(pendingCreate.id);
      } else {
        await db.syncQueue.put({
          id: `sync_product_delete_${id}`,
          type: "PRODUCT",
          action: "DELETE",
          data: { id },
          createdAt: Date.now(),
          attempts: 0,
        });
      }

      const pendingStockCreates = await db.syncQueue.where("type").equals("STOCK").toArray();
      await Promise.all(
        pendingStockCreates
          .filter((item) => item.data?.payload?.productId === id)
          .map((item) => db.syncQueue.delete(item.id))
      );

      await db.products.delete(id);
      await db.stock.where("productId").equals(id).delete();

      set((state) => ({
        products: state.products.filter((product) => product.id !== id),
        isLoading: false,
        error: "Product deleted offline - will sync when online",
      }));
    }
  },

  syncProducts: async () => {
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products?take=1000`, { headers });
      if (response.ok) {
        const data = await response.json();
        const products = data.data;

        const pendingOfflineProducts = await getPendingOfflineProducts();
        const transformedProducts = products.map(transformApiProduct);
        const mergedProducts = await withQueuedInventoryAdjustments([...transformedProducts, ...pendingOfflineProducts]);

        await Promise.all(
          mergedProducts.map((p: any) => db.products.put(p))
        );

        set({
          products: mergedProducts,
          lastSynced: Date.now(),
        });
      }
    } catch (error) {
      console.error("Error syncing products:", error);
    }
  },

  clearProducts: () => {
    set({ products: [], error: null });
  },
}));
