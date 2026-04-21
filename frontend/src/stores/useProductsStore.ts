import { create } from "zustand";
import { db, StoredProduct } from "../lib/db";
import { useAuthStore } from "./useAuthStore";

export function transformApiProduct(p: any): StoredProduct {
  const retailPrice = p.prices?.find((pr: any) => pr.customerType === 'RETAIL')?.unitPrice || 0;
  const wholesalePrice = p.prices?.find((pr: any) => pr.customerType === 'WHOLESALE')?.unitPrice || retailPrice;
  const totalQuantity = (p.stock || []).reduce((sum: number, batch: any) => {
    return sum + (batch.quantity - batch.quantityUsed);
  }, 0);

  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    barcode: p.barcode,
    description: p.description,
    isActive: p.isActive,
    retail: {
      unitPrice: retailPrice,
      discount: p.prices?.find((pr: any) => pr.customerType === 'RETAIL')?.discount || 0,
    },
    wholesale: {
      unitPrice: wholesalePrice,
      discount: p.prices?.find((pr: any) => pr.customerType === 'WHOLESALE')?.discount || 0,
    },
    stock: {
      quantity: totalQuantity,
    },
    lastSynced: Date.now(),
  };
}

function buildProductPayload(data: {
  name: string;
  categoryId: string;
  barcode?: string;
  retailPrice: number;
  wholesalePrice: number;
  costPrice: number;
  reorderPoint?: number;
}) {
  return {
    name: data.name,
    categoryId: data.categoryId,
    barcode: data.barcode,
    description: "",
    isActive: true,
    reorderPoint: data.reorderPoint ?? 10,
    prices: [
      {
        customerType: "RETAIL",
        unitPrice: data.retailPrice,
        costPrice: data.costPrice,
        discount: 0,
      },
      {
        customerType: "WHOLESALE",
        unitPrice: data.wholesalePrice,
        costPrice: data.costPrice,
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

async function searchCachedProducts(query: string) {
  const needle = query.trim().toLowerCase();
  const cached = await db.products.toArray();

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
  loadProducts: () => Promise<void>;
  searchProducts: (query: string) => Promise<void>;
  getProductById: (id: string) => Promise<StoredProduct | undefined>;
  createProduct: (data: {
    name: string;
    categoryId: string;
    barcode?: string;
    retailPrice: number;
    wholesalePrice: number;
    costPrice: number;
    reorderPoint?: number;
  }) => Promise<void>;
  syncProducts: () => Promise<void>;
  clearProducts: () => void;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  lastSynced: null,

  loadProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Try to fetch from API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products?take=1000`, { headers });

      if (response.ok) {
        const data = await response.json();
        const products = data.data;

        const pendingOfflineProducts = await getPendingOfflineProducts();
        const transformedProducts = products.map(transformApiProduct);
        const mergedProducts = [...transformedProducts, ...pendingOfflineProducts];

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
      const cached = await db.products.toArray();
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

  searchProducts: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      if (!query.trim()) {
        await get().loadProducts();
        return;
      }

      // First try API search
      try {
        const token = useAuthStore.getState().token;
        const headers: any = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/products?search=${encodeURIComponent(query)}`,
          { headers }
        );
        if (response.ok) {
          const data = await response.json();
          const products = data.data;

          const transformedProducts = products.map(transformApiProduct);

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
      const results = await searchCachedProducts(query);

      set({ products: results, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  getProductById: async (id: string) => {
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Try API first
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${parseInt(id)}`, { headers });
        if (response.ok) {
          const data = await response.json();
          const product = data.data;

          const transformedProduct = transformApiProduct(product);

          await db.products.put(transformedProduct);
          return transformedProduct;
        }
      } catch {}

      // Fall back to local cache
      return await db.products.get(parseInt(id));
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
        throw new Error("Failed to create product");
      }

      const result = await response.json();
      const newProduct = result.data;

      // Transform and save to IndexedDB
      const transformedProduct: StoredProduct = {
        id: newProduct.id,
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
        stock: { quantity: 0 },
        lastSynced: Date.now(),
      };

      await db.products.put(transformedProduct);

      // Reload products
      await get().loadProducts();
      set({ isLoading: false });
    } catch (error: any) {
      // Fallback: save to IndexedDB with offline ID
      const localProductId = Date.now();
      const payload = buildProductPayload(data);
      const offlineProduct: StoredProduct = {
        id: localProductId,
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
      await get().loadProducts();
      set({ isLoading: false, error: "Product saved offline - will sync when online" });
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
        const mergedProducts = [...transformedProducts, ...pendingOfflineProducts];

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
