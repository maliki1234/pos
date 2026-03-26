import axios, { AxiosInstance } from "axios";
import { db, StoredTransaction } from "./db";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

class POSApiClient {
  private client: AxiosInstance;
  private isOnline: boolean = true;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    this.setupInterceptors();
    this.setupOnlineListener();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use((config) => {
      const session = localStorage.getItem("userSession");
      if (session) {
        const { token } = JSON.parse(session);
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (!this.isOnline || error.code === "ERR_NETWORK") {
          console.log("Offline - queueing request");
          return Promise.reject({ isOffline: true, error });
        }
        return Promise.reject(error);
      }
    );
  }

  private setupOnlineListener() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true;
        console.log("Connection restored - syncing data");
        this.syncPendingRequests();
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        console.log("Connection lost - working offline");
      });

      this.isOnline = navigator.onLine;
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post("/auth/login", { email, password });
    return response.data.data;
  }

  async register(email: string, password: string, name: string, role: string) {
    const response = await this.client.post("/auth/register", {
      email,
      password,
      name,
      role,
    });
    return response.data.data;
  }

  // Products
  async getProducts(filters?: any) {
    try {
      const response = await this.client.get("/products", { params: filters });
      return response.data.data;
    } catch (error: any) {
      if (error.isOffline) {
        return await db.products.toArray();
      }
      throw error;
    }
  }

  async getProduct(id: string) {
    try {
      const response = await this.client.get(`/products/${id}`);
      return response.data.data;
    } catch (error: any) {
      if (error.isOffline) {
        return await db.products.get(id);
      }
      throw error;
    }
  }

  async createProduct(data: any) {
    const response = await this.client.post("/products", data);
    return response.data.data;
  }

  // Customers
  async getCustomers(filters?: any) {
    try {
      const response = await this.client.get("/customers", { params: filters });
      return response.data.data;
    } catch (error: any) {
      if (error.isOffline) {
        return await db.customers.toArray();
      }
      throw error;
    }
  }

  async createCustomer(data: any) {
    const response = await this.client.post("/customers", data);
    return response.data.data;
  }

  // Transactions
  async getTransactions(filters?: any) {
    try {
      const response = await this.client.get("/transactions", { params: filters });
      return response.data.data;
    } catch (error: any) {
      if (error.isOffline) {
        return await db.transactions.toArray();
      }
      throw error;
    }
  }

  async createTransaction(data: any) {
    try {
      const response = await this.client.post("/transactions", data);
      return response.data.data;
    } catch (error: any) {
      if (error.isOffline) {
        return await this.queueTransaction(data);
      }
      throw error;
    }
  }

  // Stock
  async getStock(productId: number) {
    try {
      const response = await this.client.get(`/stock/${productId}`);
      return response.data.data;
    } catch (error: any) {
      if (error.isOffline) {
        return await db.products.get(productId);
      }
      throw error;
    }
  }

  async updateStock(productId: number, data: any) {
    const response = await this.client.post(`/stock/${productId}`, data);
    return response.data.data;
  }

  // Offline/Sync utilities
  private async queueTransaction(data: any) {
    const offlineId = `offline_${Date.now()}_${Math.random()}`;
    const transaction: StoredTransaction = {
      id: offlineId,
      transactionNo: offlineId,
      customerId: data.customerId,
      items: data.items,
      subtotal: data.subtotal || 0,
      discountAmount: data.discountAmount || 0,
      taxAmount: data.taxAmount || 0,
      totalAmount: data.totalAmount || 0,
      paymentMethod: data.paymentMethod,
      paymentStatus: "PENDING",
      notes: data.notes,
      isVoided: false,
      createdAt: Date.now(),
      syncStatus: "OFFLINE",
      offlineId,
    };

    await db.transactions.add(transaction);
    await db.syncQueue.add({
      id: `sync_${offlineId}`,
      type: "TRANSACTION",
      action: "CREATE",
      data,
      createdAt: Date.now(),
      attempts: 0,
    });

    return transaction;
  }

  private async syncPendingRequests() {
    const queuedRequests = await db.syncQueue.toArray();
    for (const request of queuedRequests) {
      try {
        if (request.type === "TRANSACTION") {
          await this.client.post("/transactions", request.data);
          if (request.data?.transactionNumber) {
            await db.transactions.update(request.data.transactionNumber, {
              syncStatus: "SYNCED",
              syncedAt: Date.now(),
            });
          }
          await db.syncQueue.delete(request.id);
        }
      } catch (error) {
        await db.syncQueue.update(request.id, {
          attempts: request.attempts + 1,
          lastError: String(error),
        });
      }
    }
  }

  getIsOnline() {
    return this.isOnline;
  }
}

export const apiClient = new POSApiClient();
