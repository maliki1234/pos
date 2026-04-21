import { create } from "zustand";
import { db, StoredCategory } from "../lib/db";
import { isOfflineFallbackError } from "@/lib/syncHelpers";
import { useAuthStore } from "./useAuthStore";

interface CategoriesState {
  categories: StoredCategory[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadCategories: () => Promise<void>;
  createCategory: (data: { name: string; description?: string }) => Promise<void>;
  updateCategory: (id: string, data: { name: string; description?: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  syncCategories: () => Promise<void>;
}

async function getPendingOfflineCategories() {
  const pendingCreates = await db.syncQueue.where("type").equals("CATEGORY").toArray();
  const localIds = pendingCreates
    .map((item) => item.data?.localCategoryId)
    .filter((id): id is string => typeof id === "string");

  if (localIds.length === 0) return [];
  const categories = await Promise.all(localIds.map((id) => db.categories.get(id)));
  return categories.filter(Boolean) as StoredCategory[];
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  loadCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Try to fetch from API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        const categories = data.data || [];

        // Transform and save to IndexedDB
        const transformedCategories = categories.map((ct: any) => ({
          id: ct.id,
          name: ct.name,
          description: ct.description || "",
          isActive: ct.isActive ?? true,
          lastSynced: Date.now(),
        }));

        const pendingOfflineCategories = await getPendingOfflineCategories();
        const mergedCategories = [...transformedCategories, ...pendingOfflineCategories];

        await Promise.all(mergedCategories.map((ct: any) => db.categories.put(ct)));

        set({
          categories: mergedCategories,
          isLoading: false,
        });
      } else {
        throw new Error("Failed to fetch categories");
      }
    } catch (error: any) {
      // Fall back to cached categories from IndexedDB
      const cached = await db.categories.toArray();
      if (cached.length > 0) {
        set({
          categories: cached,
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

  createCategory: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Try API first
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: data.name,
          description: data.description || "",
          isActive: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to create category");
      }

      const result = await response.json();
      const newCategory = result.data;

      const transformedCategory: StoredCategory = {
        id: newCategory.id,
        name: newCategory.name,
        description: newCategory.description || "",
        isActive: newCategory.isActive,
        lastSynced: Date.now(),
      };

      await db.categories.put(transformedCategory);
      await get().loadCategories();
      set({ isLoading: false });
    } catch (error: any) {
      if (!isOfflineFallbackError(error)) {
        set({ error: error.message, isLoading: false });
        throw error;
      }
      // Fallback: save offline
      const offlineId = `offline_${Date.now()}_${Math.random()}`;
      const offlineCategory: StoredCategory = {
        id: offlineId,
        name: data.name,
        description: data.description || "",
        isActive: true,
        lastSynced: Date.now(),
      };

      await db.categories.put(offlineCategory);
      await db.syncQueue.put({
        id: `sync_category_${offlineId}`,
        type: "CATEGORY",
        action: "CREATE",
        data: {
          localCategoryId: offlineId,
          payload: {
            name: data.name,
            description: data.description || "",
            isActive: true,
          },
        },
        createdAt: Date.now(),
        attempts: 0,
      });
      await get().loadCategories();
      set({ isLoading: false, error: "Category saved offline - will sync when online" });
    }
  },

  updateCategory: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update category");
      }

      await get().loadCategories();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  deleteCategory: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to delete category");
      }

      await get().loadCategories();
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  syncCategories: async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`);
      if (response.ok) {
        const data = await response.json();
        const categories = data.data || [];

        const transformedCategories = categories.map((ct: any) => ({
          id: ct.id,
          name: ct.name,
          description: ct.description || "",
          isActive: ct.isActive ?? true,
          lastSynced: Date.now(),
        }));

        await Promise.all(
          transformedCategories.map((ct: any) => db.categories.put(ct))
        );

        set({ categories: transformedCategories });
      }
    } catch (error) {
      console.error("Error syncing categories:", error);
    }
  },
}));
