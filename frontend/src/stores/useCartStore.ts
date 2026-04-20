import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db, StoredTransaction } from "../lib/db";

export interface CartItem {
  productId: number;
  productName?: string;
  quantity: number;
  price: number;
  discount?: number;
}

export interface PaymentSplit {
  method: string;
  amount: number;
}

type PaymentMethod = "CASH" | "CARD" | "MOBILE_MONEY" | "AZAMPAY" | "CHEQUE" | "BANK_TRANSFER" | "CREDIT";

interface CartState {
  items: CartItem[];
  customerId?: string;
  storeId?: string;
  paymentMethod: PaymentMethod;
  pricingType: "RETAIL" | "WHOLESALE";
  dueDate?: string;
  loyaltyPointsToRedeem: number;
  notes?: string;
  mpesaRef?: string;
  payments?: PaymentSplit[];

  // Calculated values
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;

  // Actions
  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  updateItem: (productId: number, quantity: number) => void;
  setCustomer: (customerId: string) => void;
  setStore: (storeId: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setDueDate: (date: string) => void;
  setLoyaltyRedemption: (points: number, kesValue: number) => void;
  setPricingType: (type: "RETAIL" | "WHOLESALE") => void;
  setNotes: (notes: string) => void;
  setMpesaRef: (ref: string | undefined) => void;
  setPayments: (payments: PaymentSplit[] | undefined) => void;
  applyDiscount: (amount: number) => void;
  calculateTotals: () => void;
  submitTransaction: () => Promise<StoredTransaction>;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      paymentMethod: "CASH",
      pricingType: "RETAIL",
      loyaltyPointsToRedeem: 0,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
      mpesaRef: undefined,
      payments: undefined,

      addItem: (item: CartItem) => {
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          let newItems;

          if (existing) {
            newItems = state.items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            );
          } else {
            newItems = [...state.items, item];
          }

          // Calculate totals inline
          const subtotal = newItems.reduce((sum, cartItem) => {
            const price = Number(cartItem.price) || 0;
            const qty = Number(cartItem.quantity) || 0;
            return sum + (price * qty);
          }, 0);
          const taxRate = 0.1;
          const taxableAmount = Math.max(0, subtotal - state.discountAmount);
          const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
          const totalAmount = subtotal - state.discountAmount + taxAmount;

          return {
            items: newItems,
            subtotal,
            taxAmount,
            totalAmount,
          };
        });
      },

      removeItem: (productId: number) => {
        set((state) => {
          const newItems = state.items.filter((i) => i.productId !== productId);

          // Calculate totals inline
          const subtotal = newItems.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            return sum + (price * qty);
          }, 0);
          const taxRate = 0.1;
          const taxableAmount = Math.max(0, subtotal - state.discountAmount);
          const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
          const totalAmount = subtotal - state.discountAmount + taxAmount;

          return {
            items: newItems,
            subtotal,
            taxAmount,
            totalAmount,
          };
        });
      },

      updateItem: (productId: number, quantity: number) => {
        set((state) => {
          const newItems =
            quantity <= 0
              ? state.items.filter((i) => i.productId !== productId)
              : state.items.map((i) =>
                  i.productId === productId ? { ...i, quantity } : i
                );

          // Calculate totals inline
          const subtotal = newItems.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            return sum + (price * qty);
          }, 0);
          const taxRate = 0.1;
          const taxableAmount = Math.max(0, subtotal - state.discountAmount);
          const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
          const totalAmount = subtotal - state.discountAmount + taxAmount;

          return {
            items: newItems,
            subtotal,
            taxAmount,
            totalAmount,
          };
        });
      },

      setCustomer: (customerId: string) => {
        set({ customerId });
      },

      setStore: (storeId: string) => {
        set({ storeId });
      },

      setPaymentMethod: (method) => {
        set({ paymentMethod: method });
      },

      setDueDate: (date: string) => {
        set({ dueDate: date });
      },

      setLoyaltyRedemption: (points: number, kesValue: number) => {
        set((state) => {
          const newDiscount = Math.min(state.discountAmount + kesValue, state.subtotal);
          const taxableAmount = Math.max(0, state.subtotal - newDiscount);
          const taxAmount = Math.round(taxableAmount * 0.1 * 100) / 100;
          const totalAmount = state.subtotal - newDiscount + taxAmount;
          return {
            loyaltyPointsToRedeem: points,
            discountAmount: newDiscount,
            taxAmount,
            totalAmount,
          };
        });
      },

      setPricingType: (type: "RETAIL" | "WHOLESALE") => {
        set({ pricingType: type });
      },

      setNotes: (notes: string) => {
        set({ notes });
      },

      setMpesaRef: (ref: string | undefined) => {
        set({ mpesaRef: ref });
      },

      setPayments: (payments: PaymentSplit[] | undefined) => {
        set({ payments });
      },

      applyDiscount: (amount: number) => {
        set((state) => {
          const newDiscount = Math.min(amount, state.subtotal);
          const taxRate = 0.1;
          const taxableAmount = Math.max(0, state.subtotal - newDiscount);
          const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
          const totalAmount = state.subtotal - newDiscount + taxAmount;

          return {
            discountAmount: newDiscount,
            taxAmount,
            totalAmount,
          };
        });
      },

      calculateTotals: () => {
        const { items, discountAmount } = get();
        const subtotal = items.reduce((sum, item) => {
          const price = Number(item.price) || 0;
          const qty = Number(item.quantity) || 0;
          return sum + (price * qty);
        }, 0);
        const taxRate = 0.1; // 10% tax
        const taxableAmount = Math.max(0, subtotal - discountAmount);
        const taxAmount = Math.round(taxableAmount * taxRate * 100) / 100;
        const totalAmount = subtotal - discountAmount + taxAmount;

        set({
          subtotal,
          taxAmount,
          totalAmount,
        });
      },

      submitTransaction: async () => {
        const { items, customerId, storeId, paymentMethod, notes, discountAmount, totalAmount, dueDate, loyaltyPointsToRedeem, mpesaRef, payments } =
          get();

        if (items.length === 0) {
          throw new Error("Cart is empty");
        }

        const offlineId = `offline_${Date.now()}_${Math.random()}`;
        if (paymentMethod === "CREDIT" && !customerId) {
          throw new Error("Credit transactions require a customer to be selected");
        }

        const transaction: StoredTransaction = {
          id: offlineId,
          transactionNo: offlineId,
          customerId,
          items: items as any,
          subtotal: get().subtotal,
          discountAmount,
          taxAmount: get().taxAmount,
          totalAmount,
          paymentMethod,
          paymentStatus: "PENDING",
          notes,
          isVoided: false,
          createdAt: Date.now(),
          syncStatus: "OFFLINE",
          offlineId,
        };

        // Save to IndexedDB
        await db.transactions.add(transaction);

        // Queue for sync (backend will handle stock deduction)
        await db.syncQueue.add({
          id: `sync_${offlineId}`,
          type: "TRANSACTION",
          action: "CREATE",
          data: { ...transaction, storeId, dueDate, loyaltyPointsToRedeem, mpesaRef, payments },
          createdAt: Date.now(),
          attempts: 0,
        });

        // Clear cart after submission
        get().clearCart();

        return transaction;
      },

      clearCart: () => {
        set({
          items: [],
          customerId: undefined,
          paymentMethod: "CASH",
          notes: undefined,
          dueDate: undefined,
          loyaltyPointsToRedeem: 0,
          mpesaRef: undefined,
          payments: undefined,
          subtotal: 0,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: 0,
        });
      },
    }),
    {
      name: "pos-cart-storage",
      merge: (persistedState: any, currentState: CartState) => {
        if (!persistedState) return currentState;
        return {
          ...currentState,
          ...persistedState,
          items: (persistedState.items || []).map((item: any) => ({
            ...item,
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            discount: item.discount ? Number(item.discount) : undefined,
          })),
          subtotal: Number(persistedState.subtotal) || 0,
          discountAmount: Number(persistedState.discountAmount) || 0,
          taxAmount: Number(persistedState.taxAmount) || 0,
          totalAmount: Number(persistedState.totalAmount) || 0,
        };
      },
    }
  )
);
