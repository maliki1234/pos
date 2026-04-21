import Dexie, { Table } from "dexie";

export interface StoredCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  lastSynced: number;
}

export interface StoredProduct {
  id: number;
  name: string;
  categoryId: string;
  barcode?: string;
  description?: string;
  isActive: boolean;
  retail?: {
    unitPrice: number;
    discount: number;
  };
  wholesale?: {
    unitPrice: number;
    discount: number;
  };
  stock?: {
    quantity: number;
  };
  lastSynced: number;
}

export interface StoredStock {
  id: string;
  productId: number;
  batchNumber: string;
  quantity: number;
  quantityUsed: number;
  unitCost: number;
  expiryDate?: number; // Timestamp
  receivedDate: number;
  notes?: string;
  isActive: boolean;
  lastSynced: number;
}

export interface StoredCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  customerType: "RETAIL" | "WHOLESALE";
  isActive: boolean;
  lastSynced: number;
}

export interface StoredTransaction {
  id: string;
  transactionNo: string;
  customerId?: string;
  userId?: string;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  isVoided: boolean;
  createdAt: number;
  syncedAt?: number;
  syncStatus: "OFFLINE" | "PENDING" | "SYNCED" | "FAILED";
  offlineId?: string; // Temporary ID when created offline
}

export interface StoredCreditLedger {
  id: string;
  customerId: string;
  transactionId: string;
  originalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  dueDate?: number;
  status: "OUTSTANDING" | "PARTIAL" | "SETTLED" | "OVERDUE";
  notes?: string;
  repayments: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
    createdAt: number;
  }>;
  lastSynced: number;
}

export interface SyncQueue {
  id: string;
  type: "TRANSACTION" | "PRODUCT" | "STOCK" | "CUSTOMER";
  action: "CREATE" | "UPDATE" | "DELETE";
  data: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface UserSession {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
  token: string;
  expiresAt: number;
  pinHash?: string;
}

export interface OfflineMeta {
  key: string;
  value: any;
  updatedAt: number;
}

export class POSDatabase extends Dexie {
  categories!: Table<StoredCategory>;
  products!: Table<StoredProduct>;
  stock!: Table<StoredStock>;
  customers!: Table<StoredCustomer>;
  transactions!: Table<StoredTransaction>;
  syncQueue!: Table<SyncQueue>;
  userSession!: Table<UserSession>;
  creditLedger!: Table<StoredCreditLedger>;
  offlineMeta!: Table<OfflineMeta>;

  constructor() {
    super("POSDatabase");
    
    // Version 1: Original schema (kept for backward compatibility)
    this.version(1).stores({
      products: "id, sku, lastSynced",
      customers: "id, email, customerType, lastSynced",
      transactions: "id, transactionNo, customerId, syncStatus, createdAt",
      syncQueue: "id, type, action, createdAt, attempts",
      userSession: "id",
    });

    // Version 2: Add Categories and Stock tables
    this.version(2).stores({
      categories: "id, name, lastSynced",
      products: "id, sku, lastSynced",
      stock: "id, productId, batchNumber, receivedDate, expiryDate",
      customers: "id, email, customerType, lastSynced",
      transactions: "id, transactionNo, customerId, syncStatus, createdAt",
      syncQueue: "id, type, action, createdAt, attempts",
      userSession: "id",
    });

    // Version 3: Add Credit Ledger table
    this.version(3).stores({
      categories: "id, name, lastSynced",
      products: "id, sku, lastSynced",
      stock: "id, productId, batchNumber, receivedDate, expiryDate",
      customers: "id, email, customerType, lastSynced",
      transactions: "id, transactionNo, customerId, syncStatus, createdAt",
      syncQueue: "id, type, action, createdAt, attempts",
      userSession: "id",
      creditLedger: "id, customerId, status, dueDate, lastSynced",
    });

    // Version 4: Track offline readiness metadata
    this.version(4).stores({
      categories: "id, name, lastSynced",
      products: "id, sku, lastSynced",
      stock: "id, productId, batchNumber, receivedDate, expiryDate",
      customers: "id, email, customerType, lastSynced",
      transactions: "id, transactionNo, customerId, syncStatus, createdAt",
      syncQueue: "id, type, action, createdAt, attempts",
      userSession: "id",
      creditLedger: "id, customerId, status, dueDate, lastSynced",
      offlineMeta: "key, updatedAt",
    });
  }
}

export const db = new POSDatabase();
